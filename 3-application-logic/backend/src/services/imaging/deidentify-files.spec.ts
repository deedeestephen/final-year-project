import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { crc32 } from 'node:zlib';
import * as dicomParser from 'dicom-parser';
import {
  SYNTHETIC_DICOM_IDENTIFIERS as ID,
  makeSyntheticDicom,
} from '../../../test/fixtures/synthetic-files';
import {
  DeidentificationError,
  deidentifyDicomHead,
  replaceHead,
  sameLengthUid,
  stripImageMetadata,
  uidFromHash,
  yearOnlyDates,
} from './deidentify-files';

const newUid = (original: string) =>
  uidFromHash(createHmac('sha256', 'test-key').update(original).digest('hex'));

const parse = (b: Buffer) =>
  dicomParser.parseDicom(new Uint8Array(b.buffer, b.byteOffset, b.length));

describe('DICOM de-identification', () => {
  const original = makeSyntheticDicom('MR', { identifiers: true });
  const { head, changed } = deidentifyDicomHead(original, newUid);
  const before = parse(original);
  const after = parse(head);
  const text = head.toString('latin1');

  it('removes every identifying value, including nested and private ones', () => {
    for (const value of [
      ID.patientName,
      ID.patientId,
      ID.birthDate,
      ID.accession,
      ID.institution,
      ID.referringPhysician,
      ID.deviceSerial,
      ID.address,
      ID.privateValue,
      ID.nestedName,
    ]) {
      expect(text).not.toContain(value);
    }
    expect(original.toString('latin1')).toContain(ID.patientName);
  });

  it('keeps the file the same size and readable, and the pixels identical', () => {
    expect(head.length).toBe(original.length);
    const pixels = (ds: dicomParser.DataSet, b: Buffer) => {
      const el = ds.elements.x7fe00010;
      return b.subarray(el.dataOffset, el.dataOffset + el.length);
    };
    expect(pixels(after, head).equals(pixels(before, original))).toBe(true);
    expect(after.string('x00080060')).toBe('MR');
    expect(after.string('x00080016')).toBe(before.string('x00080016'));
    expect(after.uint16('x00280010')).toBe(8);
    expect(after.string('x00100040')).toBe('M'); // sex is not an identifier
  });

  it('keeps only the year of dates and zeroes times', () => {
    expect(after.string('x00080020')).toBe('20260101');
    expect(after.string('x00080030')).toBe('000000.000');
  });

  it('replaces UIDs consistently with same-length, stable values', () => {
    const sop = before.string('x00080018')!;
    const newSop = after.string('x00080018')!;
    expect(newSop).not.toBe(sop);
    expect(newSop.startsWith('2.25.')).toBe(true);
    expect(after.string('x00020003')).toBe(newSop);
    const nested = after.elements.x00081110.items![0].dataSet!;
    expect(nested.string('x00081155')).toBe(newSop);
    expect(after.string('x0020000d')).not.toBe(before.string('x0020000d'));
    // Stable: the same original always gives the same replacement.
    expect(deidentifyDicomHead(original, newUid).head.equals(head)).toBe(true);
  });

  it('gives files of one study the same new study UID', () => {
    const study = '2.25.123456789012345678901234567890';
    const a = parse(
      deidentifyDicomHead(
        makeSyntheticDicom('MR', { studyInstanceUid: study }),
        newUid,
      ).head,
    );
    const b = parse(
      deidentifyDicomHead(
        makeSyntheticDicom('MR', { studyInstanceUid: study }),
        newUid,
      ).head,
    );
    expect(a.string('x0020000d')).toBe(b.string('x0020000d'));
    expect(a.string('x0020000d')).not.toBe(study);
  });

  it('reports which attributes changed, never their values', () => {
    expect(changed).toEqual(
      expect.arrayContaining([
        'Patient Name',
        'Patient ID',
        'Patient Birth Date',
        'Institution Name',
        'Study Date',
        'SOP Instance UID',
        'Private attributes',
      ]),
    );
    expect(changed.join(' ')).not.toContain('SYNTHETIC');
  });

  it('refuses a file whose scanner burned patient details into the image', () => {
    expect(() =>
      deidentifyDicomHead(makeSyntheticDicom('MR', { burnedIn: true }), newUid),
    ).toThrow(DeidentificationError);
  });

  it('refuses a header that is cut off', () => {
    expect(() =>
      deidentifyDicomHead(original.subarray(0, 300), newUid),
    ).toThrow('The DICOM header could not be read completely');
  });
});

describe('date, time and UID helpers', () => {
  it('keeps the year of dates and date-times', () => {
    expect(yearOnlyDates('20260920')).toBe('20260101');
    expect(yearOnlyDates('20260920\\20250101')).toBe('20260101\\20250101');
    expect(yearOnlyDates('20260920143015.250000+0200')).toBe(
      '20260101000000.000000+0000',
    );
    expect(yearOnlyDates('2026')).toBe('2026');
  });

  it('fits a UID into exactly the original length', () => {
    expect(sameLengthUid('2.25.123456', 10)).toBe('2.25.12345');
    expect(sameLengthUid('2.25.12', 10)).toBe('2.25.12\0\0\0');
    expect(sameLengthUid('2.25.12345', 6)).toBe('2.25.1');
    // Never ends with a dot: that would not be a valid UID.
    expect(sameLengthUid('2.25.12345', 5)).toBe('2.25\0');
    expect(uidFromHash('f'.repeat(64))).toMatch(/^2\.25\.[1-9][0-9]{0,38}$/);
  });
});

describe('JPEG and PNG metadata', () => {
  const seg = (marker: number, body: Buffer) => {
    const header = Buffer.alloc(4);
    header.writeUInt8(0xff, 0);
    header.writeUInt8(marker, 1);
    header.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([header, body]);
  };
  const scan = Buffer.from([
    0xff, 0xda, 0x00, 0x04, 0x01, 0x00, 0x11, 0x22, 0xff, 0xd9,
  ]);

  it('removes EXIF and comments from a JPEG and keeps the image data', () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      seg(0xe0, Buffer.from('JFIF\0SYN')),
      seg(0xe1, Buffer.from('Exif\0\0SYNTHETIC-EXIF-SERIAL')),
      seg(0xfe, Buffer.from('SYNTHETIC comment')),
      seg(0xdb, Buffer.alloc(65, 1)),
      scan,
    ]);
    const { file, removed } = stripImageMetadata(jpeg, 'JPEG');
    expect(removed).toBe(2);
    expect(file.toString('latin1')).not.toContain('SYNTHETIC-EXIF-SERIAL');
    expect(file.toString('latin1')).not.toContain('SYNTHETIC comment');
    expect(file.toString('latin1')).toContain('JFIF');
    expect(file.subarray(file.length - scan.length).equals(scan)).toBe(true);
  });

  it('removes text chunks from a PNG and keeps the image chunks', () => {
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(body));
      return Buffer.concat([len, body, crc]);
    };
    const ihdr = chunk(
      'IHDR',
      Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0]),
    );
    const idat = chunk(
      'IDAT',
      Buffer.from([0x78, 0x9c, 0x63, 0, 0, 0, 2, 0, 1]),
    );
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ihdr,
      chunk('tEXt', Buffer.from('Author\0SYNTHETIC Operator')),
      idat,
      chunk('tIME', Buffer.alloc(7, 1)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    const { file, removed } = stripImageMetadata(png, 'PNG');
    expect(removed).toBe(2);
    expect(file.toString('latin1')).not.toContain('SYNTHETIC Operator');
    expect(file.includes(ihdr) && file.includes(idat)).toBe(true);
  });

  it('refuses a damaged file', () => {
    expect(() => stripImageMetadata(Buffer.from('not a jpeg'), 'JPEG')).toThrow(
      DeidentificationError,
    );
    expect(() => stripImageMetadata(Buffer.from('not a png!'), 'PNG')).toThrow(
      DeidentificationError,
    );
  });
});

describe('replaceHead (streaming)', () => {
  it('replaces only the first bytes, whatever the chunk sizes', async () => {
    const original = Buffer.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    const head = Buffer.from('abcdefghij');
    const chunks = [3, 4, 2, 7, 10].reduce<Buffer[]>((acc, n) => {
      const used = acc.reduce((s, c) => s + c.length, 0);
      return [...acc, original.subarray(used, used + n)];
    }, []);
    const out: Buffer[] = [];
    for await (const c of Readable.from(chunks).pipe(replaceHead(head))) {
      out.push(c as Buffer);
    }
    expect(Buffer.concat(out).toString()).toBe('abcdefghijKLMNOPQRSTUVWXYZ');
  });
});
