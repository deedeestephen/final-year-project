/** Number and date formatting shared by the dashboard charts. */

/** A clean axis maximum: 1, 2 or 5 times a power of ten, at least 4. */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

const fmt = new Intl.NumberFormat('en-GB');
export const formatCount = (n: number) => fmt.format(n);

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/**
 * "28 Sep" from "2026-09-28". The date is already a Zambian calendar day, so
 * no time zone applies, and fixed month names read the same in every browser.
 */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1] ?? ''}`.trim();
}
