/**
 * @module vendor-payment-terms
 *
 * Sub-resource type for the vendor's payment-terms agreement. Unlike
 * contacts / bank accounts / tax identifiers, payment terms is a single
 * record per vendor — `paymentTerms`, `creditLimit`, and `creditDays` are
 * denormalised onto the parent {@link Vendor} by {@link parseVendor}.
 */

/**
 * The negotiated payment-terms record for one vendor.
 */
export interface VendorPaymentTermsDetails {
  /** Surrogate primary key. */
  id: number;

  /**
   * Credit-period code as a raw string. Use {@link PaymentTerms} on read
   * paths that need a typed enum (the value is widened to `string` here so
   * the backend can introduce new codes without a type-level breaking
   * change).
   */
  paymentTerms: string;

  /** Maximum outstanding balance allowed, in the organisation's base currency. */
  creditLimit?: number;

  /**
   * Calendar days of credit. Mirrors the digits in the {@link PaymentTerms}
   * code when one of the `NET{n}` values is set.
   */
  creditDays?: number;
}
