/**
 * @module types/date-helpers
 *
 * Lightweight UTC-safe date parser used by domain parsers
 * (`parseUser`, `parseAttendance`, ...).
 *
 * Many backend APIs return ISO-like timestamps without a timezone suffix
 * (e.g. `"2026-02-25T10:30:00"`). JavaScript's `new Date()` interprets
 * those as **local time**, which causes incorrect relative-time displays
 * when the client timezone differs from the server (UTC).
 *
 * This helper appends a `'Z'` when no timezone indicator is present so the
 * timestamp is correctly treated as UTC.
 */

/**
 * Parses a value as a `Date`, treating naive ISO timestamps as UTC.
 *
 * Accepts:
 * - `string` — ISO-like timestamp; a trailing `Z` is appended when no
 *   timezone marker (`Z`, `±HH:MM`) is detected.
 * - `Date` — returned as-is when valid.
 * - `number` — interpreted as a millisecond epoch.
 *
 * Returns `null` (rather than throwing) on `null`/`undefined` input or on
 * any parse failure, so callers can compose it inside parsers without
 * try/catch noise.
 *
 * @param value - The raw value to parse.
 * @returns A valid `Date`, or `null` for nullish input and unparseable strings.
 *
 * @example
 * ```ts
 * parseUTCDate('2026-02-25T10:30:00');     // treated as UTC, not local
 * parseUTCDate('2026-02-25T10:30:00Z');    // unchanged — already UTC
 * parseUTCDate('2026-02-25T10:30:00+05:30'); // unchanged — offset preserved
 * parseUTCDate(null);                       // null
 * parseUTCDate('not a date');               // null
 * ```
 */
export function parseUTCDate(
  value: string | Date | number | null | undefined
): Date | null {
  if (value == null) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // If the string looks like an ISO timestamp without timezone info, append 'Z'
  let str = value.trim();
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str) &&
    !/[Zz]$/.test(str) &&
    !/[+-]\d{2}:\d{2}$/.test(str)
  ) {
    str += 'Z';
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}
