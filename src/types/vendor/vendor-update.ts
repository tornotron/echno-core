/**
 * @module vendor-update
 *
 * Request payload + serializer for the update-vendor endpoint. The
 * serializer applies the same camelCase ↔ wire-format remap used by
 * {@link createVendorToJson}.
 */
import { VendorType, VendorStatus } from './enums';

/**
 * Payload shape accepted by the update-vendor endpoint. Every field is
 * optional — only set fields are sent and applied.
 */
export interface UpdateVendorRequest {
  /** Vendor's display name. */
  name?: string;

  /** Primary contact email. */
  email?: string;

  /** Postal / billing address. */
  address?: string;

  /** Vendor website URL. */
  website?: string;

  /** City portion of the address. */
  city?: string;

  /** State / province portion of the address. */
  state?: string;

  /** PIN / postal / ZIP code. */
  pincode?: string;

  /** Country portion of the address. */
  country?: string;

  /** Trade category — see {@link VendorType}. */
  type?: VendorType;

  /** Trading relationship state — see {@link VendorStatus}. */
  status?: VendorStatus;

  /** Free-form internal notes about the vendor. */
  notes?: string;
}

/**
 * Serialises an {@link UpdateVendorRequest} for the update-vendor endpoint.
 *
 * @param dto - The domain-side update request.
 * @returns A plain object using the backend's wire-format field names
 *   (`vendorName`, `vendorEmail`, `vendorAddress`, `pinCode`). Keys whose
 *   values are `undefined` are still included; the backend ignores
 *   them.
 */
export function updateVendorToJson(
  dto: UpdateVendorRequest
): Record<string, unknown> {
  return {
    vendorName: dto.name,
    vendorEmail: dto.email,
    vendorAddress: dto.address,
    website: dto.website,
    city: dto.city,
    state: dto.state,
    pinCode: dto.pincode,
    country: dto.country,
    type: dto.type,
    status: dto.status,
    notes: dto.notes,
  };
}
