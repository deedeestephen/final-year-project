import * as dicomParser from 'dicom-parser';

/**
 * Technical fields read from a DICOM header. Patient tags (name, ID, birth
 * date) are deliberately never read or returned.
 */
export interface DicomSummary {
  modality?: string;
  studyInstanceUid?: string;
  seriesInstanceUid?: string;
  sopClassUid?: string;
  transferSyntaxUid?: string;
  rows?: number;
  columns?: number;
}

/** Reads the header from the first bytes of a DICOM file; throws if it cannot. */
export function readDicomHeader(head: Buffer): DicomSummary {
  const bytes = new Uint8Array(head.buffer, head.byteOffset, head.length);
  // Stop before the pixel data: only the header is needed.
  const ds = dicomParser.parseDicom(bytes, { untilTag: 'x7fe00010' });
  const text = (tag: string) => ds.string(tag)?.trim() || undefined;
  return {
    modality: text('x00080060'),
    studyInstanceUid: text('x0020000d'),
    seriesInstanceUid: text('x0020000e'),
    sopClassUid: text('x00080016'),
    transferSyntaxUid: text('x00020010'),
    rows: ds.uint16('x00280010'),
    columns: ds.uint16('x00280011'),
  };
}

/** DICOM modality codes accepted for each modality the app offers. */
export const DICOM_MODALITY_CODES = {
  MRI: ['MR'],
  CT: ['CT'],
  TRUS: ['US'],
} as const;
