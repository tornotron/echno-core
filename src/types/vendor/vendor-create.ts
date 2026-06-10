/**
 * @module vendor-create
 *
 * Request payload + serializer for `POST /vendors/web`. The serializer
 * remaps the canonical camelCase {@link Vendor} field names (`name`,
 * `email`, `address`, `pincode`) onto the backend's wire-format names
 * (`vendorName`, `vendorEmail`, `vendorAddress`, `pinCode`).
 */
import { VendorType, VendorStatus } from './enums';

/**
 * Payload shape accepted by the create-vendor endpoint. `name` and `email`
 * are required by the backend; every other field is optional.
 */
export interface CreateVendorRequest {
  /** Vendor's display name. Required. */
  name: string;

  /** Primary contact email. Required. */
  email: string;

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

  /** Initial trading state — see {@link VendorStatus}. */
  status?: VendorStatus;

  /** Free-form internal notes about the vendor. */
  notes?: string;
}

/**
 * Serialises a {@link CreateVendorRequest} for transmission to
 * `POST /vendors/web`.
 *
 * @param dto - The domain-side create request.
 * @returns A plain object using the backend's wire-format field names
 *   (`vendorName`, `vendorEmail`, `vendorAddress`, `pinCode`).
 */
export function createVendorToJson(
  dto: CreateVendorRequest
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
