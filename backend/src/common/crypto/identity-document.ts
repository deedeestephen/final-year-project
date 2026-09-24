import { FieldCrypto, normalizeNationalId } from './field-crypto';

export const ID_DOCUMENT_TYPES = ['NRC', 'PASSPORT'] as const;
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];

/** Zambian National Registration Card: 123456/78/1 (spaces ignored). */
const NRC = /^\d{6}\/\d{2}\/\d$/;
/** Passport numbers: 6-12 letters or digits (spaces ignored). */
const PASSPORT = /^[A-Z0-9]{6,12}$/;

export function normalizeIdNumber(type: IdDocumentType, value: string): string {
  return type === 'NRC'
    ? normalizeNationalId(value)
    : value.replace(/\s+/g, '').toUpperCase();
}

/** Null when valid, otherwise a message for the `idNumber` field. */
export function idNumberProblem(
  type: IdDocumentType,
  value: string,
): string | null {
  const v = normalizeIdNumber(type, value);
  if (type === 'NRC') {
    return NRC.test(v)
      ? null
      : 'idNumber must be an NRC number like 123456/78/1';
  }
  return PASSPORT.test(v)
    ? null
    : 'idNumber must be a passport number of 6-12 letters or digits';
}

/**
 * Keyed hash for exact matching. NRC uses the same form as patient records
 * (`patients.national_id_hmac`), so a self-registered account can be matched
 * to its clinic record; passports are kept in a separate namespace.
 */
export function idNumberHmac(
  crypto: FieldCrypto,
  type: IdDocumentType,
  value: string,
): string {
  const v = normalizeIdNumber(type, value);
  return crypto.hmac(type === 'NRC' ? v : `PASSPORT:${v}`);
}

/** Shows only the last 4 characters. */
export function maskIdentifier(value: string): string {
  const keep = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${keep}`;
}
