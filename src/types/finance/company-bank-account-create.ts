/**
 * @module types/finance/company-bank-account-create
 *
 * The {@link CreateCompanyBankAccountRequest} payload and serializer for
 * creating an organization bank account.
 */

/** Fields for creating a company bank account. `ledgerAccountId` is required. */
export interface CreateCompanyBankAccountRequest {
  /** Bank name (max 200). */
  bankName?: string;
  /** Account number (max 50). */
  accountNumber?: string;
  /** Account holder name (max 200). */
  accountHolderName?: string;
  /** IFSC code (max 20). */
  ifscCode?: string;
  /** SWIFT/BIC code (max 20). */
  swiftCode?: string;
  /** Whether this becomes the organization's default account. */
  isDefault?: boolean;
  /** Linked GL ledger account id. Required. */
  ledgerAccountId: string;
}

/**
 * Serializes a {@link CreateCompanyBankAccountRequest} into the backend request
 * body. The required `ledgerAccountId` is always emitted; optional fields only
 * when set.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching `CreateCompanyBankAccountRequest`.
 */
export function createCompanyBankAccountToJson(
  dto: CreateCompanyBankAccountRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    ledgerAccountId: dto.ledgerAccountId,
  };
  if (dto.bankName !== undefined) json.bankName = dto.bankName;
  if (dto.accountNumber !== undefined) json.accountNumber = dto.accountNumber;
  if (dto.accountHolderName !== undefined)
    json.accountHolderName = dto.accountHolderName;
  if (dto.ifscCode !== undefined) json.ifscCode = dto.ifscCode;
  if (dto.swiftCode !== undefined) json.swiftCode = dto.swiftCode;
  if (dto.isDefault !== undefined) json.isDefault = dto.isDefault;
  return json;
}
