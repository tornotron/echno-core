/**
 * @module types/date-helpers
 *
 * The date conversions every request serializer and response parser in this
 * package is expected to go through.
 *
 * The problem they exist to solve is that a backend field declared
 * `java.time.LocalDateTime` or `java.time.LocalDate` carries **no offset**, and
 * JavaScript has no type for a value with no offset. A `Date` is always an
 * instant. So every crossing between the two has to state, explicitly, which
 * reading is meant. Picking the wrong one does not throw and usually does not
 * look wrong: it shifts the value by the client's offset, and only surfaces
 * later when something derives a calendar date or compares against a configured
 * local time.
 *
 * There are three kinds of value on the wire and two directions, and the whole
 * set is here so that a serializer never has to improvise one:
 *
 * | Wire value | Backend type | Write with | Read with |
 * |---|---|---|---|
 * | Instant the **server** recorded (`createdAt`, `updatedAt`, `verifiedAt`, `approvedAt`) | `LocalDateTime`, written in UTC | never written by the client | {@link parseUTCDate} |
 * | Wall clock the **user** saw (a clock punch, a movement start) | `LocalDateTime` | {@link toLocalDateTimeString} | {@link parseLocalDateTime} |
 * | Calendar date with no time of day (a date of birth, a task's start) | `LocalDateTime` at midnight, or `LocalDate` | {@link toLocalDateAtMidnight} | {@link parseLocalDateTime} for `LocalDateTime`, {@link parseLocalDate} for `LocalDate` |
 *
 * Two rules follow, and `date-serialization.guard.test.ts` enforces both:
 *
 * 1. **Never `Date.toISOString()` onto the wire.** It emits UTC with a trailing
 *    `Z`. The backend now annotates its request DTOs
 *    `@JsonFormat(lenient = OptBoolean.FALSE)`, so an offset-bearing value is a
 *    400 rather than a silent truncation, but the rule predates that and does
 *    not depend on it.
 * 2. **Never `new Date(value)` off the wire.** It reads a naive timestamp as
 *    local, which is right for exactly one of the three rows above.
 *
 * The direction that is easy to forget is that both halves have to agree. A
 * field written with {@link toLocalDateAtMidnight} and read back with
 * {@link parseUTCDate} round-trips correctly in a positive-offset zone and
 * lands on the previous day in a negative-offset one.
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

/**
 * Formats a `Date` as a naive local wall-clock timestamp,
 * `YYYY-MM-DDTHH:mm:ss`, with no timezone suffix.
 *
 * This is the counterpart to {@link parseLocalDateTime} and the format expected
 * by backend fields declared as `java.time.LocalDateTime`. Those fields carry no
 * offset, so sending `Date.toISOString()` (which is UTC and ends in `Z`) shifts
 * the recorded wall-clock time by the client's offset: a 09:00 punch in IST
 * arrives as 03:30, and a 00:30 punch lands on the previous day.
 *
 * The components are read with the local getters (`getFullYear`, `getHours`, …),
 * so the string reproduces the time the user actually saw on their device.
 *
 * Note this deliberately discards the offset rather than converting it. It is
 * correct only where the client's timezone is the same as the one the value will
 * be interpreted in. See {@link parseLocalDateTime}.
 *
 * @param date - The date to format.
 * @returns A naive local timestamp, e.g. `'2026-08-27T09:00:00'`.
 *
 * @example
 * ```ts
 * // Client in IST (UTC+05:30), 09:00 local:
 * toLocalDateTimeString(d); // '2026-08-27T09:00:00'
 * d.toISOString();          // '2026-08-27T03:30:00.000Z'  <- shifted
 * ```
 */
export function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Parses a value as a `Date`, treating naive ISO timestamps as **local** time.
 *
 * Use this for fields whose contract is a local wall-clock time, such as an
 * attendance clock punch. It is the read-side counterpart to
 * {@link toLocalDateTimeString}, and the deliberate opposite of
 * {@link parseUTCDate}, which is for server-generated instants (`createdAt`,
 * `updatedAt`, `verifiedAt`) that the backend records in UTC.
 *
 * A value that does carry an explicit `Z` or `±HH:MM` is honoured as written,
 * so a caller that has a real instant is not silently reinterpreted.
 *
 * Returns `null` on nullish input or an unparseable string, matching
 * {@link parseUTCDate}.
 *
 * @param value - The raw value to parse.
 * @returns A valid `Date`, or `null`.
 *
 * @example
 * ```ts
 * parseLocalDateTime('2026-08-27T09:00:00');       // 09:00 in the client's zone
 * parseLocalDateTime('2026-08-27T09:00:00Z');      // 09:00 UTC, offset honoured
 * parseLocalDateTime('2026-08-27T09:00:00+05:30'); // offset honoured
 * ```
 */
export function parseLocalDateTime(
  value: string | Date | number | null | undefined
): Date | null {
  if (value == null) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // `new Date()` already reads a naive ISO date-time as local, and honours an
  // explicit offset when one is present. The work here is rejecting the values
  // it would otherwise coerce into a nonsense Date.
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a `Date` as `YYYY-MM-DDT00:00:00` from its **local** calendar date.
 *
 * The shape backend fields want when the value is a calendar date but the column
 * is a `LocalDateTime`: a date of birth, a joining date, a task's start and end,
 * a project's start and end. All of those are entered through a
 * `<input type="date">`, so they carry no time of day, and the backend stores the
 * time component as zero.
 *
 * The local getters are the point. Reading the UTC calendar date instead returns
 * the **previous day** for any `Date` at local midnight in a positive-offset zone,
 * which is exactly how a date of birth ends up a day early. It is a subtle failure
 * because it is only wrong for some inputs: a `Date` built from
 * `new Date('2026-08-27')` is UTC midnight and reads back correctly either way,
 * while one from a calendar picker is local midnight and does not.
 *
 * For a value that genuinely carries a time of day, use
 * {@link toLocalDateTimeString} instead.
 *
 * @param date - The date to format.
 * @returns The local calendar date with a zeroed time, e.g. `'2026-08-27T00:00:00'`.
 */
export function toLocalDateAtMidnight(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00`;
}

/**
 * Parses a bare calendar date, `YYYY-MM-DD`, as **local** midnight.
 *
 * The read-side counterpart to {@link toLocalDateAtMidnight}, for the fields the
 * backend declares as `java.time.LocalDate` rather than `LocalDateTime`: an
 * attendance record's `attendanceDate`, a labour joining date. Those serialize
 * as `'2026-08-27'`, with no time part at all.
 *
 * {@link parseLocalDateTime} is not the right tool for them, despite the name.
 * A date-only string is the one form the ECMAScript spec requires `new Date()`
 * to read as **UTC**, so `new Date('2026-08-27')` is midnight UTC, which is the
 * previous day everywhere west of Greenwich. Building the date from its parts
 * with the local constructor is what avoids that.
 *
 * A value that carries a time part is delegated to {@link parseLocalDateTime},
 * so an endpoint that widens `LocalDate` to `LocalDateTime` does not break its
 * callers.
 *
 * @param value - The raw value to parse.
 * @returns A `Date` at local midnight on the given day, or `null`.
 *
 * @example
 * ```ts
 * // Client in America/New_York (UTC-04:00):
 * parseLocalDate('2026-08-27');      // 27 Aug 2026, 00:00 local
 * new Date('2026-08-27');            // 26 Aug 2026, 20:00 local  <- shifted
 * ```
 */
export function parseLocalDate(
  value: string | Date | number | null | undefined
): Date | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (match) {
      const d = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return parseLocalDateTime(value);
}
