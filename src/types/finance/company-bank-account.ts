/**
 * @module types/finance/company-bank-account
 *
 * The {@link CompanyBankAccount} entity (backend `CompanyBankAccountDto`) — an
 * organization bank account linked to a GL ledger account — and its parser.
 * The write payload lives in `company-bank-account-create.ts` (re-exported).
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  nullableBoolean,
  nullableString,
} from '../../lib/validation/backend-schema';

const CompanyBankAccountResponseSchema = z.object({
  id: z.string().nullish(),
  bankName: nullableString,
  accountNumber: nullableString,
  accountHolderName: nullableString,
  ifscCode: nullableString,
  swiftCode: nullableString,
  isDefault: nullableBoolean,
  active: nullableBoolean,
  ledgerAccountId: nullableString,
  ledgerAccountCode: nullableString,
  ledgerAccountName: nullableString,
});

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
export function parseCompanyBankAccount(json: unknown): CompanyBankAccount {
  const raw = CompanyBankAccountResponseSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseCompanyBankAccount.id'),
    bankName: raw.bankName ?? undefined,
    accountNumber: raw.accountNumber ?? undefined,
    accountHolderName: raw.accountHolderName ?? undefined,
    ifscCode: raw.ifscCode ?? undefined,
    swiftCode: raw.swiftCode ?? undefined,
    isDefault: raw.isDefault ?? false,
    active: raw.active ?? true,
    ledgerAccountId: raw.ledgerAccountId ?? undefined,
    ledgerAccountCode: raw.ledgerAccountCode ?? undefined,
    ledgerAccountName: raw.ledgerAccountName ?? undefined,
  };
}

export {
  type CreateCompanyBankAccountRequest,
  createCompanyBankAccountToJson,
} from './company-bank-account-create';
