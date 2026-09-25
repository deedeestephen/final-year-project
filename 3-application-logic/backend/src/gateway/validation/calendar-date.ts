import { registerDecorator, type ValidationOptions } from 'class-validator';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date `YYYY-MM-DD` between 1900-01-01 and today (UTC). */
export function isPastCalendarDate(
  value: unknown,
  today = new Date(),
): boolean {
  if (typeof value !== 'string') return false;
  const m = DATE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects impossible dates such as 2026-02-30 (Date would roll them over).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return year >= 1900 && date.getTime() <= todayUtc;
}

/** Clinical dates (birth, encounter) must be real dates and not in the future. */
export function IsPastCalendarDate(
  options?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isPastCalendarDate',
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message:
          '$property must be a date (YYYY-MM-DD) between 1900-01-01 and today',
        ...options,
      },
      validator: { validate: (v: unknown) => isPastCalendarDate(v) },
    });
  };
}

/** Whole years between a birth date and a reference date. */
export function ageInYears(dateOfBirth: Date, on = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (on.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      on.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}
