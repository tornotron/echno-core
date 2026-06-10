/**
 * @module vendor-tax-identifiers
 *
 * Sub-resource type for vendor tax identifiers (GST, PAN, etc.). A vendor
 * may carry multiple identifiers; the `GST` and `PAN` rows are
 * denormalised onto the parent {@link Vendor} (`gstNumber`, `panNumber`)
 * by {@link parseVendor}.
 */

/**
 * A single tax identifier attached to a vendor.
 */
export interface VendorTaxIdentifier {
  /** Surrogate primary key. */
  id: number;

  /**
   * Identifier kind as a free-form string (e.g. `"GST"`, `"PAN"`, `"VAT"`,
   * `"TIN"`). Not constrained to an enum so the backend can add new tax
   * regimes without a frontend change.
   */
  type: string;

  /** The actual identifier value (e.g. the GST registration number). */
  value: string;
}
