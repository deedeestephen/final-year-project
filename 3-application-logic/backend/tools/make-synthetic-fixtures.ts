/**
 * Writes SYNTHETIC sample files for trying the upload screens by hand:
 *
 *   npm run fixtures
 *
 * Output: backend/test/fixtures/files/ (MRI, CT and ultrasound DICOM, a slide
 * TIFF and a file that is not an image). No real patient data is involved.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  makeNotAnImage,
  makeSyntheticDicom,
  makeSyntheticTiff,
} from '../test/fixtures/synthetic-files';

const dir = path.resolve(__dirname, '..', 'test', 'fixtures', 'files');
mkdirSync(dir, { recursive: true });
const files: [string, Buffer][] = [
  ['synthetic-mri.dcm', makeSyntheticDicom('MR')],
  ['synthetic-ct.dcm', makeSyntheticDicom('CT')],
  ['synthetic-trus.dcm', makeSyntheticDicom('US')],
  ['synthetic-slide.tif', makeSyntheticTiff()],
  ['not-an-image.dcm', makeNotAnImage()],
];
for (const [name, bytes] of files) {
  writeFileSync(path.join(dir, name), bytes);
  console.log(`wrote ${path.join(dir, name)} (${bytes.length} bytes)`);
}
