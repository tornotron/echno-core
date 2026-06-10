/**
 * @module vendor-bank-accounts
 *
 * Sub-resource type for vendor bank accounts. A vendor may have many
 * accounts; the default one is denormalised onto the parent {@link Vendor}
 * (`bankName`, `accountNumber`, `ifscCode`, `accountHolderName`, `swift`)
 * by {@link parseVendor}.
 */

/**
 * A single bank account attached to a vendor for payment disbursement.
 */
export interface VendorBankAccount {
  /** Surrogate primary key. */
  id: number;

  /** Name of the bank. */
  bankName?: string;

  /** Bank account number. */
  accountNumber?: string;

  /** IFSC code (India) or local equivalent. */
  ifscCode?: string;

  /** Name on the account, if different from the vendor name. */
  accountHolderName?: string;

  /** SWIFT / BIC code for international transfers. */
  swift?: string;

  /**
   * Whether this is the vendor's default payout account. Only one account
   * should carry `default: true`; {@link parseVendor} uses this flag to
   * pick the account to denormalise onto the parent vendor.
   */
  default: boolean;
}
