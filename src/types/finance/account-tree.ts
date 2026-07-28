/**
 * @module types/finance/account-tree
 *
 * The {@link AccountTreeNode} entity (backend `AccountTreeDto`) — a recursive
 * chart-of-accounts node with nested `children` — and its parser
 * {@link parseAccountTree}.
 */

import { parseUuid } from '../../lib/utils/parse-id';
import { AccountType, parseAccountType } from './finance-enums';

/* eslint-disable @typescript-eslint/no-explicit-any */

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
export function parseAccountTree(json: any): AccountTreeNode {
  return {
    id: parseUuid(json.id, 'parseAccountTree.id'),
    code: json.code ?? '',
    name: json.name ?? '',
    type: parseAccountType(json.type),
    active: json.active ?? true,
    description: json.description ?? undefined,
    postable: json.postable ?? false,
    children: Array.isArray(json.children)
      ? json.children.map((child: any) => parseAccountTree(child))
      : [],
  };
}
