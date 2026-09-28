import { ageInYears } from '../../gateway/validation/calendar-date';
import type { FieldCrypto } from '../../persistence/crypto/field-crypto';

/**
 * The 18 identifier classes of the HIPAA Safe Harbor method
 * (45 CFR 164.514(b)(2)), which the proposal adopts (NFR-10), and how the
 * FHIR export handles each one. The table is also the test plan:
 * deidentify.spec.ts has a test for every row.
 */
export interface SafeHarborRule {
  n: number;
  identifier: string;
  inThisSystem: string;
  inTheExport: string;
}

export const SAFE_HARBOR: readonly SafeHarborRule[] = [
  {
    n: 1,
    identifier: 'Names',
    inThisSystem: "Patient's given and family name (stored encrypted)",
    inTheExport: 'Removed. Names are never decrypted for an export.',
  },
  {
    n: 2,
    identifier: 'Geographic subdivisions smaller than a state',
    inThisSystem:
      "Patient's district; the facility's name, code, district and province",
    inTheExport:
      'Removed. Only the country (ZM) and the urban / peri-urban / rural class are kept.',
  },
  {
    n: 3,
    identifier:
      'All elements of dates (except year) directly related to a person; ages over 89',
    inThisSystem:
      'Date of birth, screening dates, biopsy dates, review, consent and AI dates',
    inTheExport:
      'Year only. From age 90 the birth year is removed too and the age is given as "90 or older".',
  },
  {
    n: 4,
    identifier: 'Telephone numbers',
    inThisSystem: "Patient's phone number (stored encrypted)",
    inTheExport: 'Removed.',
  },
  {
    n: 5,
    identifier: 'Fax numbers',
    inThisSystem: 'Not collected',
    inTheExport: 'Not present.',
  },
  {
    n: 6,
    identifier: 'Email addresses',
    inThisSystem: "Linked patient account's email; staff emails",
    inTheExport: 'Removed. Accounts and staff are not exported.',
  },
  {
    n: 7,
    identifier: 'Social security numbers (in Zambia: NRC or passport number)',
    inThisSystem:
      'National registration card or passport number (stored encrypted)',
    inTheExport: 'Removed.',
  },
  {
    n: 8,
    identifier: 'Medical record numbers',
    inThisSystem: "Facility's medical record number (MRN)",
    inTheExport:
      'Removed. Each patient gets an export pseudonym instead (row 18).',
  },
  {
    n: 9,
    identifier: 'Health plan beneficiary numbers',
    inThisSystem: 'Not collected',
    inTheExport: 'Not present.',
  },
  {
    n: 10,
    identifier: 'Account numbers',
    inThisSystem: 'App account ids of patients and staff',
    inTheExport: 'Removed.',
  },
  {
    n: 11,
    identifier: 'Certificate or licence numbers',
    inThisSystem: 'Not collected',
    inTheExport: 'Not present.',
  },
  {
    n: 12,
    identifier: 'Vehicle identifiers and serial numbers',
    inThisSystem: 'Not collected',
    inTheExport: 'Not present.',
  },
  {
    n: 13,
    identifier: 'Device identifiers and serial numbers',
    inThisSystem:
      'Scanner details inside uploaded DICOM files; phones are not linked to patients',
    inTheExport:
      'Removed. Image and slide files, and their headers, are not exported.',
  },
  {
    n: 14,
    identifier: 'Web addresses (URLs)',
    inThisSystem: 'Storage keys of uploaded files',
    inTheExport: 'Removed. No file references are exported.',
  },
  {
    n: 15,
    identifier: 'IP addresses',
    inThisSystem: 'Audit log only',
    inTheExport: 'Removed. The audit log is not exported.',
  },
  {
    n: 16,
    identifier: 'Biometric identifiers',
    inThisSystem: 'Not collected',
    inTheExport: 'Not present.',
  },
  {
    n: 17,
    identifier: 'Full-face photographs and comparable images',
    inThisSystem:
      'Not collected. Medical images (MRI, ultrasound, CT, slides) are stored but are not exported.',
    inTheExport: 'Not present.',
  },
  {
    n: 18,
    identifier: 'Any other unique identifying number, characteristic or code',
    inThisSystem:
      'Internal and client-generated ids; free-text notes; free-text slide stain',
    inTheExport:
      'Ids replaced by keyed pseudonyms that cannot be reversed without the server key; free text removed.',
  },
];

/**
 * A stable, non-reversible id for one exported resource. It is an HMAC of
 * the internal id (itself a random UUID, not derived from anything about the
 * person), with the server's key and a per-kind prefix, shaped as a UUID
 * (version 8, RFC 9562). The same patient gets the same pseudonym in every
 * export while the key is unchanged, so researchers can follow a person over
 * time without learning who they are. This is the "re-identification code"
 * Safe Harbor allows: only the server can recompute it.
 */
export function exportId(
  crypto: FieldCrypto,
  kind: string,
  internalId: string,
): string {
  const hex = crypto.hmac(`fhir-export:${kind}:${internalId}`).slice(0, 32);
  const version = `8${hex.slice(13, 16)}`;
  const variant =
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    version,
    variant,
    hex.slice(20, 32),
  ].join('-');
}

/** The year only (Safe Harbor keeps years). */
export function yearOnly(date: Date): string {
  return String(date.getUTCFullYear()).padStart(4, '0');
}

/** Ages of 90 and over are grouped into one category (Safe Harbor). */
export const AGE_GROUP_LIMIT = 90;

export type BirthDetails =
  { kind: 'birthYear'; birthYear: string } | { kind: 'ninetyOrOver' };

/** Birth year, unless the person is 90 or older on `asOf`. */
export function birthDetails(dateOfBirth: Date, asOf: Date): BirthDetails {
  return ageInYears(dateOfBirth, asOf) >= AGE_GROUP_LIMIT
    ? { kind: 'ninetyOrOver' }
    : { kind: 'birthYear', birthYear: yearOnly(dateOfBirth) };
}
