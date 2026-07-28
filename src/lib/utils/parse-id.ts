/**
 * @module types/parse-id
 *
 * Shared parser for surrogate IDs returned by the backend.
 *
 * Backend payloads typed as `number` arrive at the client as untyped JSON;
 * every domain parser (`parseUser`, `parseProject`, ...) calls this helper
 * to validate `json.id` before constructing the typed object. Centralising
 * the predicate keeps the error message format consistent across modules.
 */

/**
 * Parses a raw JSON value as a positive integer surrogate ID.
 *
 * Accepts numeric values and numeric strings. Rejects `null`, `undefined`,
 * blank or whitespace-only strings, non-finite numbers, non-integers,
 * zero, and negatives.
 *
 * @param raw - The raw value from a JSON payload (e.g. `json.id`, `json.projectId`).
 * @param context - Caller label included in error messages (e.g. `'parseUser.id'`).
 * @returns The validated positive integer.
 * @throws {TypeError} If `raw` is null/undefined/blank, non-finite, non-integer, or `<= 0`.
 *
 * @example
 * ```ts
 * const id = parsePositiveInt(json.id, 'parseUser.id');
 * // throws TypeError on '0', '', null, '12.5', '-3'
 * // accepts 42, '42', and 42.0
 * ```
 */
export function parsePositiveInt(raw: unknown, context: string): number {
  if (raw == null || (typeof raw === 'string' && !raw.trim())) {
    throw new TypeError(
      `${context}: expected a non-empty numeric value, got ${JSON.stringify(raw)}`
    );
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new TypeError(
      `${context}: expected a positive integer, got ${JSON.stringify(raw)} (parsed as ${n})`
    );
  }
  return n;
}

/**
 * Parses a raw JSON value as a required non-empty string surrogate ID (UUID).
 *
 * Unlike {@link parsePositiveInt}, this accepts the string primary keys used by
 * UUID-keyed modules (e.g. finance). Rejects `null`, `undefined`, non-strings,
 * and blank / whitespace-only strings. The value is not format-validated as a
 * canonical UUID — any non-empty string is accepted so the client tolerates
 * backend id-format changes.
 *
 * @param raw - The raw value from a JSON payload (e.g. `json.id`).
 * @param context - Caller label included in error messages (e.g. `'parseAccount.id'`).
 * @returns The validated non-empty string.
 * @throws {TypeError} If `raw` is null/undefined, not a string, or blank.
 *
 * @example
 * ```ts
 * const id = parseUuid(json.id, 'parseAccount.id');
 * // throws TypeError on '', '   ', null, 42
 * // accepts '3fa85f64-5717-4562-b3fc-2c963f66afa6'
 * ```
 */
export function parseUuid(raw: unknown, context: string): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new TypeError(
      `${context}: expected a non-empty string id, got ${JSON.stringify(raw)}`
    );
  }
  return raw;
}
