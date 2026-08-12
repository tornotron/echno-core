/**
 * @module types/finance/account
 *
 * The {@link Account} entity (a chart-of-accounts ledger account, backend
 * `AccountDto`) and its parser {@link parseAccount}. Write payloads live in
 * `account-create.ts` (re-exported here). The nested tree shape lives in
 * `account-tree.ts`.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import { AccountType, parseAccountType } from './finance-enums';
import {
  nullableBoolean,
  nullableString,
} from '../../lib/validation/backend-schema';

const AccountResponseSchema = z.object({
  id: z.string().nullish(),
  code: nullableString,
  name: nullableString,
  type: nullableString,
  parentId: nullableString,
  active: nullableBoolean,
  description: nullableString,
});

/** A single ledger account in the chart of accounts. */
export interface Account {
  /** UUID primary key. */
  id: string;
  /** Human-facing account code (e.g. `'1000'`). */
  code: string;
  /** Account name. */
  name: string;
  /** Ledger classification. */
  type: AccountType;
  /** Parent account id for hierarchy; absent for roots. */
  parentId?: string;
  /** Whether the account is active. */
  active: boolean;
  /** Optional description. */
  description?: string;
}

/**
 * Parses a raw account payload into a typed {@link Account}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Account`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseAccount(json: unknown): Account {
  const raw = AccountResponseSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseAccount.id'),
    code: raw.code ?? '',
    name: raw.name ?? '',
    type: parseAccountType(raw.type),
    parentId: raw.parentId ?? undefined,
    active: raw.active ?? true,
    description: raw.description ?? undefined,
  };
}

export {
  type CreateAccountRequest,
  createAccountToJson,
} from './account-create';
