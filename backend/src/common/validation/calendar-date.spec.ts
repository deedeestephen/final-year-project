import { ageInYears, isPastCalendarDate } from './calendar-date';

describe('isPastCalendarDate', () => {
  const today = new Date('2026-09-24T10:00:00Z');

  it.each(['1958-03-14', '1900-01-01', '2026-09-24', '2024-02-29'])(
    'accepts %s',
    (d) => {
      expect(isPastCalendarDate(d, today)).toBe(true);
    },
  );

  it.each([
    ['a future date', '2026-09-25'],
    ['before 1900', '1899-12-31'],
    ['an impossible date', '2026-02-30'],
    ['a non-leap 29 February', '2025-02-29'],
    ['a wrong format', '14/03/1958'],
    ['a timestamp', '1958-03-14T00:00:00Z'],
    ['a number', 19580314],
  ])('rejects %s', (_label, value) => {
    expect(isPastCalendarDate(value, today)).toBe(false);
  });
});

describe('ageInYears', () => {
  it('counts completed years only', () => {
    const dob = new Date('1958-03-14T00:00:00Z');
    expect(ageInYears(dob, new Date('2026-03-13T00:00:00Z'))).toBe(67);
    expect(ageInYears(dob, new Date('2026-03-14T00:00:00Z'))).toBe(68);
    expect(ageInYears(dob, new Date('2026-09-24T00:00:00Z'))).toBe(68);
  });
});
