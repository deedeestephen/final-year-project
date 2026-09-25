import {
  makeSyntheticDicom,
  makeSyntheticTiff,
} from '../../../test/fixtures/synthetic-files';
import { readDicomHeader } from './dicom-header';
import { isupGradeGroup } from './imaging.service';

describe('isupGradeGroup', () => {
  it.each([
    [3, 3, 1],
    [3, 4, 2],
    [4, 3, 3],
    [4, 4, 4],
    [3, 5, 4],
    [5, 3, 4],
    [4, 5, 5],
    [5, 4, 5],
    [5, 5, 5],
  ])('Gleason %i + %i is grade group %i', (primary, secondary, group) => {
    expect(isupGradeGroup(primary, secondary)).toBe(group);
  });
});

describe('readDicomHeader', () => {
  it('reads the technical fields and never the patient tags', () => {
    const header = readDicomHeader(makeSyntheticDicom('US'));
    expect(header).toMatchObject({
      modality: 'US',
      rows: 8,
      columns: 8,
      transferSyntaxUid: '1.2.840.10008.1.2.1',
    });
    expect(Object.keys(header).sort()).toEqual([
      'columns',
      'modality',
      'rows',
      'seriesInstanceUid',
      'sopClassUid',
      'studyInstanceUid',
      'transferSyntaxUid',
    ]);
    expect(JSON.stringify(header)).not.toContain('SYNTHETIC');
  });

  it('throws on something that is not DICOM', () => {
    expect(() => readDicomHeader(makeSyntheticTiff())).toThrow();
  });
});
