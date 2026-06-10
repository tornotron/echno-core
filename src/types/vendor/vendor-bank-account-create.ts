/**
 * @module vendor-bank-account-create
 *
 * Request payloads + serializers for adding and updating a
 * {@link VendorBankAccount}. Both endpoints share the same JSON shape;
 * the update DTO simply relaxes every field to optional.
 */

/**
 * Payload shape for `POST /vendors/web/{vendorId}/bank-accounts`.
 */
export interface CreateVendorBankAccountRequest {
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
   * Whether this account should be the vendor's default payout target.
   * Setting `true` on a new account causes the backend to demote any
   * existing default.
   */
  default?: boolean;
}

/**
 * Serialises a {@link CreateVendorBankAccountRequest} for the add-bank-account endpoint.
 *
 * @param dto - The domain-side create request.
 * @returns A plain object matching the backend's expected body shape.
 */
export function createVendorBankAccountToJson(
  dto: CreateVendorBankAccountRequest
): Record<string, unknown> {
  return {
    bankName: dto.bankName,
    accountNumber: dto.accountNumber,
    ifscCode: dto.ifscCode,
    accountHolderName: dto.accountHolderName,
    swift: dto.swift,
    default: dto.default,
  };
}

/**
 * Payload shape for the update-bank-account endpoint. Every field is
 * optional — only set fields are sent and applied.
 */
export interface UpdateVendorBankAccountRequest {
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
   * Whether this account should be the vendor's default. Setting `true`
   * promotes this account and demotes the previous default.
   */
  default?: boolean;
}

/**
 * Serialises an {@link UpdateVendorBankAccountRequest} for the update-bank-account endpoint.
 *
 * @param dto - The domain-side update request.
 * @returns A plain object matching the backend's expected body shape.
 */
export function updateVendorBankAccountToJson(
  dto: UpdateVendorBankAccountRequest
): Record<string, unknown> {
  return {
    bankName: dto.bankName,
    accountNumber: dto.accountNumber,
    ifscCode: dto.ifscCode,
    accountHolderName: dto.accountHolderName,
    swift: dto.swift,
    default: dto.default,
  };
}
