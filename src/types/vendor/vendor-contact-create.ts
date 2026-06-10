/**
 * @module vendor-contact-create
 *
 * Request payloads + serializers for adding and updating a
 * {@link VendorContact}. Both endpoints share the same JSON shape; the
 * update DTO simply relaxes every field to optional.
 */

/**
 * Payload shape for `POST /vendors/web/{vendorId}/contacts`.
 */
export interface CreateVendorContactRequest {
  /** Display name of the contact person. */
  contactPerson?: string;

  /** Contact email address. */
  email?: string;

  /** Primary phone number. */
  phone?: string;

  /** Secondary phone number. */
  alternatePhone?: string;

  /**
   * Whether this contact should be the vendor's primary. Setting `true`
   * on a new contact causes the backend to demote any existing primary.
   */
  primary?: boolean;
}

/**
 * Serialises a {@link CreateVendorContactRequest} for the add-contact endpoint.
 *
 * @param dto - The domain-side create request.
 * @returns A plain object matching the backend's expected body shape.
 */
export function createVendorContactToJson(
  dto: CreateVendorContactRequest
): Record<string, unknown> {
  return {
    contactPerson: dto.contactPerson,
    email: dto.email,
    phone: dto.phone,
    alternatePhone: dto.alternatePhone,
    primary: dto.primary,
  };
}

/**
 * Payload shape for the update-contact endpoint. Every field is optional
 * — only set fields are sent and applied.
 */
export interface UpdateVendorContactRequest {
  /** Display name of the contact person. */
  contactPerson?: string;

  /** Contact email address. */
  email?: string;

  /** Primary phone number. */
  phone?: string;

  /** Secondary phone number. */
  alternatePhone?: string;

  /**
   * Whether this contact should be the vendor's primary. Setting `true`
   * promotes this contact and demotes the previous primary.
   */
  primary?: boolean;
}

/**
 * Serialises an {@link UpdateVendorContactRequest} for the update-contact endpoint.
 *
 * @param dto - The domain-side update request.
 * @returns A plain object matching the backend's expected body shape.
 */
export function updateVendorContactToJson(
  dto: UpdateVendorContactRequest
): Record<string, unknown> {
  return {
    contactPerson: dto.contactPerson,
    email: dto.email,
    phone: dto.phone,
    alternatePhone: dto.alternatePhone,
    primary: dto.primary,
  };
}
