import { sniffFile } from './file-signatures';

const withMagic = (bytes: number[], length = 200) =>
  Buffer.concat([Buffer.from(bytes), Buffer.alloc(length)]);

describe('sniffFile', () => {
  it('recognises DICOM by the DICM marker at byte 128', () => {
    const dicom = Buffer.concat([
      Buffer.alloc(128),
      Buffer.from('DICM'),
      Buffer.alloc(10),
    ]);
    expect(sniffFile(dicom)).toEqual({
      kind: 'DICOM',
      mimeType: 'application/dicom',
      extension: '.dcm',
    });
    // Too short to hold the marker.
    expect(sniffFile(Buffer.alloc(100))).toBeNull();
  });

  it('recognises PNG, JPEG, TIFF and BigTIFF in both byte orders', () => {
    expect(
      sniffFile(withMagic([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        ?.kind,
    ).toBe('PNG');
    expect(sniffFile(withMagic([0xff, 0xd8, 0xff, 0xe0]))?.kind).toBe('JPEG');
    expect(sniffFile(withMagic([0x49, 0x49, 0x2a, 0x00]))?.kind).toBe('TIFF');
    expect(sniffFile(withMagic([0x4d, 0x4d, 0x00, 0x2a]))?.kind).toBe('TIFF');
    expect(sniffFile(withMagic([0x49, 0x49, 0x2b, 0x00]))?.kind).toBe(
      'BIGTIFF',
    );
    expect(sniffFile(withMagic([0x4d, 0x4d, 0x00, 0x2b]))?.kind).toBe(
      'BIGTIFF',
    );
  });

  it('refuses anything else, whatever it is called', () => {
    expect(sniffFile(Buffer.from('%PDF-1.7 ...'))).toBeNull();
    expect(sniffFile(Buffer.from('MZ executable'))).toBeNull();
    expect(sniffFile(Buffer.alloc(0))).toBeNull();
    // A PNG signature with one byte wrong is not a PNG.
    expect(
      sniffFile(withMagic([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b])),
    ).toBeNull();
  });
});
