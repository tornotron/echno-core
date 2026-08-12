/**
 * @module types/finance/account-tree
 *
 * The {@link AccountTreeNode} entity (backend `AccountTreeDto`) — a recursive
 * chart-of-accounts node with nested `children` — and its parser
 * {@link parseAccountTree}.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import { AccountType, parseAccountType } from './finance-enums';
import {
  nullableBoolean,
  nullableString,
} from '../../lib/validation/backend-schema';

const AccountTreeResponseSchema = z.object({
  id: z.string().nullish(),
  code: nullableString,
  name: nullableString,
  type: nullableString,
  active: nullableBoolean,
  description: nullableString,
  postable: nullableBoolean,
  children: z.array(z.unknown()).nullish(),
});

/** A chart-of-accounts node with its descendants nested under `children`. */
export interface AccountTreeNode {
  /** UUID primary key. */
  id: string;
  /** Account code. */
  code: string;
  /** Account name. */
  name: string;
  /** Ledger classification. */
  type: AccountType;
  /** Whether the account is active. */
  active: boolean;
  /** Optional description. */
  description?: string;
  /** Whether journal lines may post directly to this account. */
  postable: boolean;
  /** Child accounts. */
  children: AccountTreeNode[];
}

/**
 * Parses a raw account-tree payload into a typed {@link AccountTreeNode},
 * recursing into `children`.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `AccountTreeNode`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseAccountTree(json: unknown): AccountTreeNode {
  const raw = AccountTreeResponseSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseAccountTree.id'),
    code: raw.code ?? '',
    name: raw.name ?? '',
    type: parseAccountType(raw.type),
    active: raw.active ?? true,
    description: raw.description ?? undefined,
    postable: raw.postable ?? false,
    children: Array.isArray(raw.children)
      ? raw.children.map((child) => parseAccountTree(child))
      : [],
  };
}
