/**
 * @module vendor-payment-terms-create
 *
 * Request payload + serializer for `PUT /vendors/web/{vendorId}/payment-terms`.
 * Payment terms are upserted as a single record per vendor (no add /
 * update split — the PUT idempotently overwrites whatever was there).
 */

/**
 * Payload shape for setting a vendor's payment terms.
 */
export interface SetVendorPaymentTermsRequest {
  /**
   * Credit-period code as a raw string (mirrors the {@link PaymentTerms}
   * enum values; typed as `string` so the backend can introduce new codes
   * without a type-level breaking change).
   */
  paymentTerms: string;

  /** Maximum outstanding balance allowed for this vendor. */
  creditLimit?: number;

  /** Calendar days of credit on each invoice. */
  creditDays?: number;
}

/**
 * Serialises a {@link SetVendorPaymentTermsRequest} for the
 * set-payment-terms endpoint.
 *
 * @param dto - The domain-side set request.
 * @returns A plain object matching the backend's expected body shape.
 */
export function setVendorPaymentTermsToJson(
  dto: SetVendorPaymentTermsRequest
): Record<string, unknown> {
  return {
    paymentTerms: dto.paymentTerms,
    creditLimit: dto.creditLimit,
    creditDays: dto.creditDays,
  };
}
