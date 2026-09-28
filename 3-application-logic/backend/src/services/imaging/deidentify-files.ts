import { Transform, type TransformCallback } from 'node:stream';
import * as dicomParser from 'dicom-parser';

/*
 * De-identification of uploaded image files before any AI use (NFR-10,
 * Phase 15). The original upload is kept unchanged for clinicians; the AI only
 * ever receives the de-identified copy.
 *
 * DICOM: identifying header values are overwritten IN PLACE with values of
 * exactly the same length, so every offset and length in the file stays valid
 * and the pixel data is untouched. Based on the DICOM PS3.15 Annex E Basic
 * Application Level Confidentiality Profile (the attributes relevant to this
 * system), plus Safe Harbor's "year only" rule for dates.
 */

export class DeidentificationError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'DeidentificationError';
  }
}

/** Values blanked (text: spaces; other: zero bytes). */
const BLANK: Record<string, string> = {
  x00100010: 'Patient Name',
  x00100020: 'Patient ID',
  x00100021: 'Issuer of Patient ID',
  x00100030: 'Patient Birth Date',
  x00100032: 'Patient Birth Time',
  x00101000: 'Other Patient IDs',
  x00101001: 'Other Patient Names',
  x00101005: 'Patient Birth Name',
  x00101010: 'Patient Age',
  x00101040: 'Patient Address',
  x00101060: "Patient's Mother's Birth Name",
  x00102154: 'Patient Telephone Numbers',
  x001021b0: 'Additional Patient History',
  x00104000: 'Patient Comments',
  x00080050: 'Accession Number',
  x00080080: 'Institution Name',
  x00080081: 'Institution Address',
  x00080090: 'Referring Physician Name',
  x00080092: 'Referring Physician Address',
  x00080094: 'Referring Physician Telephone Numbers',
  x00081010: 'Station Name',
  x00081030: 'Study Description',
  x00081040: 'Institutional Department Name',
  x00081048: 'Physicians of Record',
  x00081050: 'Performing Physician Name',
  x00081060: 'Name of Physicians Reading Study',
  x00081070: 'Operators Name',
  x00181000: 'Device Serial Number',
  x00200010: 'Study ID',
  x00321032: 'Requesting Physician',
  x00321060: 'Requested Procedure Description',
  x00400006: 'Scheduled Performing Physician Name',
  x00400244: 'Performed Procedure Step Start Date',
  x00400253: 'Performed Procedure Step ID',
  x00404037: 'Human Performer Name',
  x00020016: 'Source Application Entity Title',
};

/** Dates: year kept, month and day set to 01 (Safe Harbor keeps years). */
const DATES: Record<string, string> = {
  x00080020: 'Study Date',
  x00080021: 'Series Date',
  x00080022: 'Acquisition Date',
  x00080023: 'Content Date',
  x0008002a: 'Acquisition DateTime',
  x00080012: 'Instance Creation Date',
};

/** Times: all digits set to 0. */
const TIMES: Record<string, string> = {
  x00080030: 'Study Time',
  x00080031: 'Series Time',
  x00080032: 'Acquisition Time',
  x00080033: 'Content Time',
  x00080013: 'Instance Creation Time',
};

/** UIDs replaced by keyed, stable replacements of the same length. */
const UIDS: Record<string, string> = {
  x00020003: 'Media Storage SOP Instance UID',
  x00080018: 'SOP Instance UID',
  x0020000d: 'Study Instance UID',
  x0020000e: 'Series Instance UID',
  x00200052: 'Frame of Reference UID',
  x00081155: 'Referenced SOP Instance UID',
};

const TEXT_VRS = new Set([
  'AE',
  'AS',
  'CS',
  'DA',
  'DS',
  'DT',
  'IS',
  'LO',
  'LT',
  'PN',
  'SH',
  'ST',
  'TM',
  'UC',
  'UT',
]);
const DEFLATED = '1.2.840.10008.1.2.1.99';

export interface DicomDeidResult {
  /** The header bytes with identifying values replaced (same length). */
  head: Buffer;
  /** Names of the attributes changed (never their values). */
  changed: string[];
}

/**
 * De-identifies the header in `head` (the first bytes of the file, which must
 * contain the whole header up to the pixel data). `newUid` maps an original
 * UID to a stable replacement (a keyed hash), so files of one study still
 * belong together.
 */
export function deidentifyDicomHead(
  head: Buffer,
  newUid: (original: string) => string,
): DicomDeidResult {
  const out = Buffer.from(head);
  const bytes = new Uint8Array(out.buffer, out.byteOffset, out.length);
  let ds: dicomParser.DataSet;
  try {
    ds = dicomParser.parseDicom(bytes, { untilTag: 'x7fe00010' });
  } catch {
    throw new DeidentificationError(
      'The DICOM header could not be read completely',
    );
  }
  if (ds.string('x00020010')?.trim() === DEFLATED) {
    throw new DeidentificationError(
      'Deflated DICOM files cannot be de-identified',
    );
  }
  if (ds.string('x00280301')?.trim().toUpperCase() === 'YES') {
    throw new DeidentificationError(
      'The scanner says patient details are burned into the image pixels',
    );
  }
  const changed = new Set<string>();
  walk(ds, out, newUid, changed);
  return { head: out, changed: [...changed].sort() };
}

function walk(
  ds: dicomParser.DataSet,
  out: Buffer,
  newUid: (original: string) => string,
  changed: Set<string>,
): void {
  for (const [tag, el] of Object.entries(ds.elements)) {
    if (tag === 'x7fe00010') continue;
    if (el.items) {
      for (const item of el.items) {
        if (item.dataSet) walk(item.dataSet, out, newUid, changed);
      }
      continue;
    }
    if (el.length <= 0 || el.length === 0xffffffff) continue;
    const start = el.dataOffset;
    const end = start + el.length;
    const group = parseInt(tag.slice(1, 5), 16);
    const isPrivate = group % 2 === 1;
    const isText = el.vr ? TEXT_VRS.has(el.vr) : false;

    if (BLANK[tag] || isPrivate) {
      out.fill(isText ? 0x20 : 0x00, start, end);
      changed.add(BLANK[tag] ?? 'Private attributes');
    } else if (DATES[tag]) {
      const value = out.toString('latin1', start, end);
      out.write(yearOnlyDates(value), start, 'latin1');
      changed.add(DATES[tag]);
    } else if (TIMES[tag]) {
      const value = out.toString('latin1', start, end);
      out.write(value.replace(/[0-9]/g, '0'), start, 'latin1');
      changed.add(TIMES[tag]);
    } else if (UIDS[tag]) {
      const original = out
        .toString('latin1', start, end)
        .replace(/[\0 ]+$/, '');
      if (original) {
        out.write(sameLengthUid(newUid(original), el.length), start, 'latin1');
        changed.add(UIDS[tag]);
      }
    }
  }
}

/** Keeps the year of every date in a DA or DT value; the rest becomes 01/01 00:00. */
export function yearOnlyDates(value: string): string {
  return value
    .split('\\')
    .map((d) => {
      const m = /^(\s*)(\d{4})(\d*)(.*)$/s.exec(d);
      if (!m) return d;
      const fill = '0101000000000000'.slice(0, m[3].length);
      return `${m[1]}${m[2]}${fill}${m[4].replace(/[0-9]/g, '0')}`;
    })
    .join('\\');
}

/**
 * Fits a replacement UID into exactly `length` bytes: shortened to the space
 * available, or padded with NULL bytes (the UID padding character).
 */
export function sameLengthUid(uid: string, length: number): string {
  let value = uid.slice(0, length);
  if (value.endsWith('.')) value = value.slice(0, -1);
  return value.padEnd(length, '\0');
}

/**
 * A stable replacement UID under the "2.25" root (a UUID-sized integer made
 * from a keyed hash of the original, so it cannot be reversed).
 */
export function uidFromHash(hexHash: string): string {
  let digits = BigInt(`0x${hexHash.slice(0, 32)}`).toString(10);
  if (digits.startsWith('0')) digits = `1${digits.slice(1)}`;
  return `2.25.${digits}`;
}

// -- JPEG and PNG --------------------------------------------------------------

/**
 * Removes metadata that can identify a person or device from a JPEG (EXIF,
 * XMP, ICC, comments: APP1 to APP15 and COM segments) or a PNG (text chunks,
 * EXIF, time). Pixel data is kept byte for byte.
 */
export function stripImageMetadata(
  file: Buffer,
  kind: 'JPEG' | 'PNG',
): { file: Buffer; removed: number } {
  return kind === 'JPEG' ? stripJpeg(file) : stripPng(file);
}

function stripJpeg(file: Buffer): { file: Buffer; removed: number } {
  if (file.length < 4 || file[0] !== 0xff || file[1] !== 0xd8) {
    throw new DeidentificationError('Not a JPEG file');
  }
  const parts: Buffer[] = [file.subarray(0, 2)];
  let removed = 0;
  let i = 2;
  while (i + 4 <= file.length) {
    if (file[i] !== 0xff) {
      throw new DeidentificationError('The JPEG file is damaged');
    }
    const marker = file[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xda) {
      parts.push(file.subarray(i)); // start of scan: image data follows
      return { file: Buffer.concat(parts), removed };
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(file.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const length = file.readUInt16BE(i + 2);
    const end = i + 2 + length;
    if (length < 2 || end > file.length) {
      throw new DeidentificationError('The JPEG file is damaged');
    }
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (isMetadata) removed += 1;
    else parts.push(file.subarray(i, end));
    i = end;
  }
  throw new DeidentificationError('The JPEG file has no image data');
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(file: Buffer): { file: Buffer; removed: number } {
  if (!file.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new DeidentificationError('Not a PNG file');
  }
  const parts: Buffer[] = [PNG_SIGNATURE];
  let removed = 0;
  let i = 8;
  while (i + 12 <= file.length) {
    const length = file.readUInt32BE(i);
    const type = file.toString('latin1', i + 4, i + 8);
    const end = i + 12 + length;
    if (end > file.length) {
      throw new DeidentificationError('The PNG file is damaged');
    }
    if (PNG_DROP.has(type)) removed += 1;
    else parts.push(file.subarray(i, end));
    i = end;
    if (type === 'IEND') return { file: Buffer.concat(parts), removed };
  }
  throw new DeidentificationError('The PNG file has no end');
}

// -- streaming -------------------------------------------------------------------

/**
 * Passes a file through, replacing its first `head.length` bytes with `head`
 * (same length), so a large DICOM file is never held in memory.
 */
export function replaceHead(head: Buffer): Transform {
  let offset = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, done: TransformCallback) {
      if (offset < head.length) {
        const copy = Buffer.from(chunk);
        const n = Math.min(copy.length, head.length - offset);
        head.copy(copy, 0, offset, offset + n);
        offset += copy.length;
        done(null, copy);
        return;
      }
      offset += chunk.length;
      done(null, chunk);
    },
  });
}
