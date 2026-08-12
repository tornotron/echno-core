/**
 * @module types/finance/address
 *
 * The {@link Address} value object (backend `AddressDto`) used as a customer's
 * billing address, plus its parser and serializer. All fields are optional.
 */

import { z } from 'zod';
import { nullableString } from '../../lib/validation/backend-schema';

const AddressResponseSchema = z.object({
  line1: nullableString,
  line2: nullableString,
  city: nullableString,
  state: nullableString,
  stateCode: nullableString,
  postalCode: nullableString,
  country: nullableString,
});

/** A postal address. Mirrors the backend `AddressDto`; every field is optional. */
export interface Address {
  /** Address line 1 (max 200). */
  line1?: string;
  /** Address line 2 (max 200). */
  line2?: string;
  /** City (max 100). */
  city?: string;
  /** State / province (max 100). */
  state?: string;
  /** Two-letter state code (max 2). */
  stateCode?: string;
  /** Postal / ZIP code (max 20). */
  postalCode?: string;
  /** Two-letter ISO country code (max 2). */
  country?: string;
}

/**
 * Parses a raw address payload into a typed {@link Address}. Returns
 * `undefined` when the input is null/absent so callers can leave the field
 * unset; a present-but-malformed field fails validation.
 *
 * @param json - The untyped JSON object (or null) from the backend.
 * @returns The parsed `Address`, or `undefined` when absent.
 */
export function parseAddress(json: unknown): Address | undefined {
  if (json == null || typeof json !== 'object') return undefined;
  const raw = AddressResponseSchema.parse(json);
  return {
    line1: raw.line1 ?? undefined,
    line2: raw.line2 ?? undefined,
    city: raw.city ?? undefined,
    state: raw.state ?? undefined,
    stateCode: raw.stateCode ?? undefined,
    postalCode: raw.postalCode ?? undefined,
    country: raw.country ?? undefined,
  };
}

/**
 * Serializes an {@link Address} into the backend request body, emitting only
 * the fields that are set. Returns `undefined` when the address is absent or
 * has no populated fields.
 *
 * @param address - The address to serialize.
 * @returns A plain object matching `AddressDto`, or `undefined`.
 */
export function addressToJson(
  address: Address | undefined
): Record<string, unknown> | undefined {
  if (!address) return undefined;
  const json: Record<string, unknown> = {};
  if (address.line1 !== undefined) json.line1 = address.line1;
  if (address.line2 !== undefined) json.line2 = address.line2;
  if (address.city !== undefined) json.city = address.city;
  if (address.state !== undefined) json.state = address.state;
  if (address.stateCode !== undefined) json.stateCode = address.stateCode;
  if (address.postalCode !== undefined) json.postalCode = address.postalCode;
  if (address.country !== undefined) json.country = address.country;
  return Object.keys(json).length > 0 ? json : undefined;
}
