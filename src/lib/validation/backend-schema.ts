/**
 * @module lib/validation/backend-schema
 *
 * Shared zod building blocks for validating backend JSON at the parse boundary.
 *
 * Domain parsers historically took `json: any` and silently fabricated values
 * for anything missing or mistyped (a missing name became `'Not Specified'`, a
 * missing date became *today*). That hid backend/contract bugs and defeated the
 * type system. These helpers let each parser validate the *shape* of a response
 * first, so a structurally wrong payload fails fast with a clear path instead of
 * flowing through as a fabricated value.
 *
 * Conventions:
 * - fields the backend may legitimately omit use the `nullish` variants;
 * - unknown/extra keys are stripped by default (`z.object` is not strict), so a
 *   backend that adds a field never breaks the client;
 * - polymorphic or derived blobs (attachments, etc.) stay `unknown` and are
 *   handed to their own parser.
 */

import { z } from 'zod';

/** A surrogate id from the backend: a positive integer (numeric strings accepted). */
export const numericId = z.coerce.number().int().positive();

/** An optional surrogate id: positive integer or nullish. */
export const optionalNumericId = z.coerce.number().int().positive().nullish();

/**
 * A surrogate id that may be unassigned. Unlike {@link optionalNumericId}, this
 * accepts `0`: the backend uses `0` (or null / an omitted field) as the sentinel
 * for "no id assigned yet", so a non-negative integer or nullish all parse
 * through instead of throwing. Used where a reference is genuinely optional at
 * the record level (e.g. an inspection with no inspector assigned).
 */
export const unassignedNumericId = z.coerce.number().int().nonnegative().nullish();

/** A string the backend may send as null or omit entirely. */
export const nullableString = z.string().nullish();

/**
 * An ISO-like timestamp the backend sends as a string (or omits). Validated as a
 * string here; callers convert it with `parseUTCDate`. Not `z.date()` because the
 * value is still a raw string at the boundary.
 */
export const backendDate = z.string().nullish();

/** A boolean the backend may omit. */
export const nullableBoolean = z.boolean().nullish();

/** A number the backend may omit. */
export const nullableNumber = z.number().nullish();

/**
 * A monetary amount. The backend may send it as a number or a numeric string
 * (e.g. a BigDecimal serialized as a string); coerced to a number, nullish
 * allowed. Prevents a money field silently becoming `0` or `NaN`.
 */
export const money = z.coerce.number().nullish();

/** A blob left to a dedicated parser (attachments, nested polymorphic shapes). */
export const opaque = z.unknown().nullish();
