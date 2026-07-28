/**
 * @module types/finance/company-bank-account
 *
 * The {@link CompanyBankAccount} entity (backend `CompanyBankAccountDto`) — an
 * organization bank account linked to a GL ledger account — and its parser.
 * The write payload lives in `company-bank-account-create.ts` (re-exported).
 */

import { parseUuid } from '../../lib/utils/parse-id';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** An organization bank account, linked to a ledger account in the chart of accounts. */
export interface CompanyBankAccount {
  /** UUID primary key. */
  id: string;
  /** Bank name. */
  bankName?: string;
  /** Account number. */
  accountNumber?: string;
  /** Account holder name. */
  accountHolderName?: string;
  /** IFSC code (India). */
  ifscCode?: string;
  /** SWIFT/BIC code (international). */
  swiftCode?: string;
  /** Whether this is the organization's default account. */
  isDefault: boolean;
  /** Whether the account is active. */
  active: boolean;
  /** Linked GL ledger account id. */
  ledgerAccountId?: string;
  /** Linked GL ledger account code (denormalized). */
  ledgerAccountCode?: string;
  /** Linked GL ledger account name (denormalized). */
  ledgerAccountName?: string;
}

/**
 * Parses a raw company-bank-account payload into a typed
 * {@link CompanyBankAccount}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `CompanyBankAccount`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseCompanyBankAccount(json: any): CompanyBankAccount {
  return {
    id: parseUuid(json.id, 'parseCompanyBankAccount.id'),
    bankName: json.bankName ?? undefined,
    accountNumber: json.accountNumber ?? undefined,
    accountHolderName: json.accountHolderName ?? undefined,
    ifscCode: json.ifscCode ?? undefined,
    swiftCode: json.swiftCode ?? undefined,
    isDefault: json.isDefault ?? false,
    active: json.active ?? true,
    ledgerAccountId: json.ledgerAccountId ?? undefined,
    ledgerAccountCode: json.ledgerAccountCode ?? undefined,
    ledgerAccountName: json.ledgerAccountName ?? undefined,
  };
}

export {
  type CreateCompanyBankAccountRequest,
  createCompanyBankAccountToJson,
} from './company-bank-account-create';
