/**
 * @module vendor-tax-identifier-create
 *
 * Request payloads + serializers for adding and updating a
 * {@link VendorTaxIdentifier}. The create DTO requires both `type` and
 * `value`; the update DTO relaxes both to optional.
 */

/**
 * Payload shape for `POST /vendors/web/{vendorId}/tax-identifiers`.
 */
export interface CreateVendorTaxIdentifierRequest {
  /**
   * Identifier kind (e.g. `"GST"`, `"PAN"`, `"VAT"`, `"TIN"`). The set is
   * not constrained on the client so the backend can introduce new tax
   * regimes without a frontend release.
   */
  type: string;

  /** The actual identifier value (e.g. the GST registration number). */
  value: string;
}

/**
 * Serialises a {@link CreateVendorTaxIdentifierRequest} for the
 * add-tax-identifier endpoint.
 *
 * @param dto - The domain-side create request.
 * @returns A plain object matching the backend's expected body shape.
 */
export function createVendorTaxIdentifierToJson(
  dto: CreateVendorTaxIdentifierRequest
): Record<string, unknown> {
  return {
    type: dto.type,
    value: dto.value,
  };
}

/**
 * Payload shape for the update-tax-identifier endpoint. Every field is
 * optional — only set fields are sent and applied.
 */
export interface UpdateVendorTaxIdentifierRequest {
  /** Identifier kind to change to. */
  type?: string;

  /** Identifier value to change to. */
  value?: string;
}

/**
 * Serialises an {@link UpdateVendorTaxIdentifierRequest} for the
 * update-tax-identifier endpoint.
 *
 * @param dto - The domain-side update request.
 * @returns A plain object matching the backend's expected body shape.
 */
export function updateVendorTaxIdentifierToJson(
  dto: UpdateVendorTaxIdentifierRequest
): Record<string, unknown> {
  return {
    type: dto.type,
    value: dto.value,
  };
}
