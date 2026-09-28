import { randomUUID } from 'node:crypto';

/**
 * Tiny SYNTHETIC files for tests and manual testing. They contain no real
 * patient data: the only name is SYNTHETIC^TEST and the pixels are blank.
 */

/** A DICOM UID made from a random UUID (the "2.25" root is for exactly this). */
function uid(): string {
  return `2.25.${BigInt(`0x${randomUUID().replace(/-/g, '')}`).toString(10)}`;
}

const LONG_LENGTH_VRS = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN']);

/** One element in explicit VR little endian. */
function element(
  group: number,
  elementNo: number,
  vr: string,
  value: Buffer,
): Buffer {
  let body = value;
  if (body.length % 2 === 1) {
    const pad = vr === 'UI' || LONG_LENGTH_VRS.has(vr) ? 0x00 : 0x20;
    body = Buffer.concat([body, Buffer.from([pad])]);
  }
  const tag = Buffer.alloc(4);
  tag.writeUInt16LE(group, 0);
  tag.writeUInt16LE(elementNo, 2);
  if (LONG_LENGTH_VRS.has(vr)) {
    const header = Buffer.alloc(8);
    header.write(vr, 0, 'latin1');
    header.writeUInt32LE(body.length, 4);
    return Buffer.concat([tag, header, body]);
  }
  const header = Buffer.alloc(4);
  header.write(vr, 0, 'latin1');
  header.writeUInt16LE(body.length, 2);
  return Buffer.concat([tag, header, body]);
}

const text = (s: string) => Buffer.from(s, 'latin1');
const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

const SOP_CLASS: Record<string, string> = {
  MR: '1.2.840.10008.5.1.4.1.1.4',
  CT: '1.2.840.10008.5.1.4.1.1.2',
  US: '1.2.840.10008.5.1.4.1.1.6.1',
};

/** Made-up identifying values for de-identification tests (all SYNTHETIC). */
export const SYNTHETIC_DICOM_IDENTIFIERS = {
  patientName: 'SYNTHETIC^TEST',
  patientId: 'SYNTHETIC-0000',
  birthDate: '19580302',
  studyDate: '20260920',
  studyTime: '143015.250',
  accession: 'ACC-SYN-4411',
  institution: 'SYNTHETIC General Hospital',
  referringPhysician: 'SYNTHETIC^REFERRER',
  deviceSerial: 'SN-SYN-778899',
  address: 'Plot 1 Synthetic Road',
  privateValue: 'SYNTHETIC-PRIVATE-NOTE',
  nestedName: 'SYNTHETIC^NESTED',
};

export interface SyntheticDicomOptions {
  /** Adds the identifying attributes of SYNTHETIC_DICOM_IDENTIFIERS. */
  identifiers?: boolean;
  /** Says patient details are burned into the pixels. */
  burnedIn?: boolean;
  sopInstanceUid?: string;
  studyInstanceUid?: string;
}

/**
 * A valid DICOM Part-10 file with an 8x8 image (a simple pattern).
 * @param modality DICOM modality code: MR, CT or US.
 */
export function makeSyntheticDicom(
  modality: 'MR' | 'CT' | 'US' = 'MR',
  options: SyntheticDicomOptions = {},
): Buffer {
  const sopClass = SOP_CLASS[modality];
  const sopInstance = options.sopInstanceUid ?? uid();
  const id = SYNTHETIC_DICOM_IDENTIFIERS;
  const explicitLittleEndian = '1.2.840.10008.1.2.1';

  const metaBody = Buffer.concat([
    element(0x0002, 0x0001, 'OB', Buffer.from([0x00, 0x01])),
    element(0x0002, 0x0002, 'UI', text(sopClass)),
    element(0x0002, 0x0003, 'UI', text(sopInstance)),
    element(0x0002, 0x0010, 'UI', text(explicitLittleEndian)),
  ]);
  const meta = Buffer.concat([
    element(0x0002, 0x0000, 'UL', u32(metaBody.length)),
    metaBody,
  ]);

  const rows = 8;
  const columns = 8;
  const pixels = Buffer.alloc(rows * columns * 2);
  if (options.identifiers) {
    for (let i = 0; i < pixels.length; i += 2) pixels.writeUInt16LE(i * 7, i);
  }
  // A sequence item holding a nested name and a referenced UID.
  const nestedItem = Buffer.concat([
    element(0x0008, 0x1155, 'UI', text(sopInstance)),
    element(0x0010, 0x0010, 'PN', text(id.nestedName)),
  ]);
  const itemHeader = Buffer.alloc(8);
  itemHeader.writeUInt16LE(0xfffe, 0);
  itemHeader.writeUInt16LE(0xe000, 2);
  itemHeader.writeUInt32LE(nestedItem.length, 4);
  const withIds = (...parts: Buffer[]) => (options.identifiers ? parts : []);
  const dataset = Buffer.concat([
    element(0x0008, 0x0016, 'UI', text(sopClass)),
    element(0x0008, 0x0018, 'UI', text(sopInstance)),
    ...withIds(
      element(0x0008, 0x0020, 'DA', text(id.studyDate)),
      element(0x0008, 0x0030, 'TM', text(id.studyTime)),
      element(0x0008, 0x0050, 'SH', text(id.accession)),
    ),
    element(0x0008, 0x0060, 'CS', text(modality)),
    ...withIds(
      element(0x0008, 0x0080, 'LO', text(id.institution)),
      element(0x0008, 0x0090, 'PN', text(id.referringPhysician)),
      element(0x0008, 0x1110, 'SQ', Buffer.concat([itemHeader, nestedItem])),
      // A private creator and a private value (group 0x0009 is odd).
      element(0x0009, 0x0010, 'LO', text('SYNTHETIC VENDOR')),
      element(0x0009, 0x1001, 'LO', text(id.privateValue)),
    ),
    element(0x0010, 0x0010, 'PN', text(id.patientName)),
    element(0x0010, 0x0020, 'LO', text(id.patientId)),
    ...withIds(
      element(0x0010, 0x0030, 'DA', text(id.birthDate)),
      element(0x0010, 0x0040, 'CS', text('M')),
      element(0x0010, 0x1040, 'LO', text(id.address)),
      element(0x0018, 0x1000, 'LO', text(id.deviceSerial)),
    ),
    element(0x0020, 0x000d, 'UI', text(options.studyInstanceUid ?? uid())),
    element(0x0020, 0x000e, 'UI', text(uid())),
    element(0x0028, 0x0002, 'US', u16(1)),
    element(0x0028, 0x0004, 'CS', text('MONOCHROME2')),
    element(0x0028, 0x0010, 'US', u16(rows)),
    element(0x0028, 0x0011, 'US', u16(columns)),
    element(0x0028, 0x0100, 'US', u16(16)),
    element(0x0028, 0x0101, 'US', u16(12)),
    element(0x0028, 0x0102, 'US', u16(11)),
    element(0x0028, 0x0103, 'US', u16(0)),
    ...(options.burnedIn ? [element(0x0028, 0x0301, 'CS', text('YES'))] : []),
    element(0x7fe0, 0x0010, 'OW', pixels),
  ]);

  return Buffer.concat([Buffer.alloc(128), text('DICM'), meta, dataset]);
}

/** A minimal little-endian TIFF (1x1 blank pixel), standing in for a slide. */
export function makeSyntheticTiff(): Buffer {
  const entries: [number, number, number, number][] = [
    // tag, type (3 = SHORT, 4 = LONG), count, value
    [256, 3, 1, 1], // ImageWidth
    [257, 3, 1, 1], // ImageLength
    [258, 3, 1, 8], // BitsPerSample
    [259, 3, 1, 1], // Compression: none
    [262, 3, 1, 1], // Photometric: black is zero
    [273, 4, 1, 0], // StripOffsets (patched below)
    [277, 3, 1, 1], // SamplesPerPixel
    [278, 3, 1, 1], // RowsPerStrip
    [279, 4, 1, 1], // StripByteCounts
  ];
  const ifdOffset = 8;
  const ifdSize = 2 + entries.length * 12 + 4;
  const pixelOffset = ifdOffset + ifdSize;
  const out = Buffer.alloc(pixelOffset + 1);
  out.write('II', 0, 'latin1');
  out.writeUInt16LE(42, 2);
  out.writeUInt32LE(ifdOffset, 4);
  out.writeUInt16LE(entries.length, ifdOffset);
  entries.forEach(([tag, type, count, value], i) => {
    const at = ifdOffset + 2 + i * 12;
    out.writeUInt16LE(tag, at);
    out.writeUInt16LE(type, at + 2);
    out.writeUInt32LE(count, at + 4);
    const v = tag === 273 ? pixelOffset : value;
    if (type === 3) out.writeUInt16LE(v, at + 8);
    else out.writeUInt32LE(v, at + 8);
  });
  out.writeUInt32LE(0, ifdOffset + 2 + entries.length * 12); // no next IFD
  return out;
}

/** A file that pretends to be DICOM by its name only. */
export function makeNotAnImage(): Buffer {
  return Buffer.from('This is plain text, not an image.\n', 'utf8');
}
