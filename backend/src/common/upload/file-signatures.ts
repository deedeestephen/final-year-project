/**
 * File-type detection from magic bytes. The declared Content-Type and the
 * file name are never trusted.
 */
export type FileKind = 'DICOM' | 'JPEG' | 'PNG' | 'TIFF' | 'BIGTIFF';

export interface DetectedFile {
  kind: FileKind;
  mimeType: string;
  extension: string;
}

const TYPES: Record<FileKind, Omit<DetectedFile, 'kind'>> = {
  DICOM: { mimeType: 'application/dicom', extension: '.dcm' },
  JPEG: { mimeType: 'image/jpeg', extension: '.jpg' },
  PNG: { mimeType: 'image/png', extension: '.png' },
  TIFF: { mimeType: 'image/tiff', extension: '.tif' },
  BIGTIFF: { mimeType: 'image/tiff', extension: '.tif' },
};

/** Bytes needed before {@link sniffFile} can decide (DICOM's marker is at 128). */
export const SNIFF_BYTES = 132;

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function startsWith(head: Buffer, bytes: number[]): boolean {
  return bytes.every((b, i) => head[i] === b);
}

export function sniffFile(head: Buffer): DetectedFile | null {
  let kind: FileKind | null = null;
  if (head.length >= 132 && head.toString('latin1', 128, 132) === 'DICM') {
    kind = 'DICOM';
  } else if (head.subarray(0, 8).equals(PNG_SIGNATURE)) {
    kind = 'PNG';
  } else if (startsWith(head, [0xff, 0xd8, 0xff])) {
    kind = 'JPEG';
  } else if (
    startsWith(head, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(head, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    kind = 'TIFF';
  } else if (
    startsWith(head, [0x49, 0x49, 0x2b, 0x00]) ||
    startsWith(head, [0x4d, 0x4d, 0x00, 0x2b])
  ) {
    kind = 'BIGTIFF';
  }
  return kind ? { kind, ...TYPES[kind] } : null;
}
