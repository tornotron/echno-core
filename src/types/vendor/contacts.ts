/**
 * @module vendor-contacts
 *
 * Sub-resource type for vendor contact people. A vendor may have many
 * contacts; the primary one is denormalised onto the parent {@link Vendor}
 * (`contactPerson`, `phone`, `alternatePhone`) by {@link parseVendor}.
 */

/**
 * A single contact person attached to a vendor.
 */
export interface VendorContact {
  /** Surrogate primary key. */
  id: number;

  /** Display name of the contact person. */
  contactPerson?: string;

  /** Contact email address. */
  email?: string;

  /** Primary phone number. */
  phone?: string;

  /** Secondary phone number. */
  alternatePhone?: string;

  /**
   * Whether this is the vendor's primary contact. Only one contact should
   * carry `primary: true`; {@link parseVendor} uses this flag to pick the
   * contact to denormalise onto the parent vendor.
   */
  primary: boolean;
}
