/**
 * Date formatting, ISO parsing, and range validation utilities.
 * Conforms to CHECKPOINT V2 display standards (DD-MM-YYYY) and ISO 8601 storage (YYYY-MM-DD).
 */

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Parses ISO string YYYY-MM-DD into year, month (0-indexed), and day */
export function parseIsoDate(
  iso: string | null | undefined,
): { year: number; month: number; day: number } | null {
  if (!iso || typeof iso !== 'string') return null;
  const parts = iso.trim().split('-');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/** Formats year, month (0-indexed), day into ISO string YYYY-MM-DD */
export function toIsoDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/** Formats ISO string YYYY-MM-DD into human display DD-MM-YYYY */
export function formatDisplayDate(iso: string | null | undefined): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso || '';
  const d = String(parsed.day).padStart(2, '0');
  const m = String(parsed.month + 1).padStart(2, '0');
  return `${d}-${m}-${parsed.year}`;
}
