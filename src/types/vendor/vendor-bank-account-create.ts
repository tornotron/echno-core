export interface CreateVendorBankAccountRequest {
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  swift?: string;
  default?: boolean;
}

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

export interface UpdateVendorBankAccountRequest {
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  swift?: string;
  default?: boolean;
}

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
