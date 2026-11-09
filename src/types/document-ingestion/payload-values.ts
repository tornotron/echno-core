/**
 * Lenient readers for one value of a candidate payload, shared by the payload readers of every
 * kind. Each never fails, so a reader built from them never throws on a payload the backend shapes
 * differently. Not exported from the package.
 *
 * @internal
 */

import { z } from 'zod';

/** A payload value as text: a string as it is, a number in its plain spelling, anything else absent. */
export const payloadText = z
  .unknown()
  .optional()
  .transform((v): string | undefined =>
    typeof v === 'string' ? (v === '' ? undefined : v) : typeof v === 'number' || typeof v === 'bigint' ? String(v) : undefined
  );

/** A payload value as a number, when it is one. */
export const payloadInt = z.unknown().optional().transform((v): number | undefined => (typeof v === 'number' ? v : undefined));

/** A payload value as a flag: true only for `true` or `"true"`. */
export const payloadFlag = z.unknown().optional().transform((v): boolean => v === true || v === 'true');

/** A payload list of text: each string or number kept, anything else dropped; a single value reads as a list of one. */
export const payloadTextList = z
  .unknown()
  .optional()
  .transform((v): string[] => {
    const items = Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
    return items
      .map((item) => (typeof item === 'string' ? item : typeof item === 'number' ? String(item) : undefined))
      .filter((item): item is string => item !== undefined && item !== '');
  });
