import { FieldCrypto } from '../../persistence/crypto/field-crypto';
import {
  AGE_GROUP_LIMIT,
  SAFE_HARBOR,
  birthDetails,
  exportId,
  yearOnly,
} from './deidentify';

const crypto = new FieldCrypto(Buffer.alloc(32, 1), Buffer.alloc(32, 2));
const otherKey = new FieldCrypto(Buffer.alloc(32, 1), Buffer.alloc(32, 3));
const UUID_V8 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Safe Harbor table', () => {
  it('lists all 18 identifier classes once, in order', () => {
    expect(SAFE_HARBOR.map((r) => r.n)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
    for (const row of SAFE_HARBOR) {
      expect(row.identifier.length).toBeGreaterThan(3);
      expect(row.inThisSystem.length).toBeGreaterThan(3);
      expect(row.inTheExport.length).toBeGreaterThan(3);
    }
  });
});

describe('exportId (pseudonyms)', () => {
  const internal = '6f1c1b0e-3a52-4c1e-9d7a-2f4b8e6c1a90';

  it('is a version 8 UUID', () => {
    expect(exportId(crypto, 'Patient', internal)).toMatch(UUID_V8);
  });

  it('is stable for the same key, so a person can be followed over time', () => {
    expect(exportId(crypto, 'Patient', internal)).toBe(
      exportId(crypto, 'Patient', internal),
    );
  });

  it('differs per resource kind and per server key', () => {
    const a = exportId(crypto, 'Patient', internal);
    expect(exportId(crypto, 'Encounter', internal)).not.toBe(a);
    expect(exportId(otherKey, 'Patient', internal)).not.toBe(a);
  });

  it('does not contain the internal id', () => {
    const id = exportId(crypto, 'Patient', internal);
    for (const part of internal.split('-')) expect(id).not.toContain(part);
  });
});

describe('dates', () => {
  it('keeps the year only', () => {
    expect(yearOnly(new Date('2026-09-20T00:00:00Z'))).toBe('2026');
    expect(yearOnly(new Date('1958-12-31T00:00:00Z'))).toBe('1958');
  });

  it('keeps the birth year below 90', () => {
    const dob = new Date('1937-10-01T00:00:00Z');
    // 88 on the export day.
    expect(birthDetails(dob, new Date('2026-09-28T00:00:00Z'))).toEqual({
      kind: 'birthYear',
      birthYear: '1937',
    });
  });

  it(`groups ages from ${AGE_GROUP_LIMIT} and removes the birth year`, () => {
    const dob = new Date('1936-09-28T00:00:00Z');
    expect(birthDetails(dob, new Date('2026-09-27T00:00:00Z'))).toEqual({
      kind: 'birthYear',
      birthYear: '1936',
    });
    // Exactly 90 on this day.
    expect(birthDetails(dob, new Date('2026-09-28T00:00:00Z'))).toEqual({
      kind: 'ninetyOrOver',
    });
  });
});
