/**
 * @module types/finance/address
 *
 * The {@link Address} value object (backend `AddressDto`) used as a customer's
 * billing address, plus its parser and serializer. All fields are optional.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
 * unset. Never throws.
 *
 * @param json - The untyped JSON object (or null) from the backend.
 * @returns The parsed `Address`, or `undefined` when absent.
 */
export function parseAddress(json: any): Address | undefined {
  if (json == null || typeof json !== 'object') return undefined;
  return {
    line1: json.line1 ?? undefined,
    line2: json.line2 ?? undefined,
    city: json.city ?? undefined,
    state: json.state ?? undefined,
    stateCode: json.stateCode ?? undefined,
    postalCode: json.postalCode ?? undefined,
    country: json.country ?? undefined,
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
