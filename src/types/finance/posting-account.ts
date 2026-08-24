/**
 * @module types/finance/posting-account
 *
 * The {@link PostingAccountMapping} entity (a single posting-role to ledger
 * account binding, backend `PostingAccountMappingDto`) and its parser
 * {@link parsePostingAccountMapping}, plus the
 * {@link UpsertPostingAccountMappingRequest} write payload and its serializer.
 *
 * A mapping tells the backend which ledger account to post to for a given
 * {@link PostingRole}. `source` records whether the binding is an explicit
 * mapping (`MAPPED`) or a built-in fallback (`DEFAULT`).
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  PostingRole,
  PostingAccountSource,
  parsePostingRole,
  parsePostingAccountSource,
} from './finance-enums';
import { nullableString } from '../../lib/validation/backend-schema';

const PostingAccountMappingResponseSchema = z.object({
  role: nullableString,
  source: nullableString,
  accountId: z.string().nullish(),
  accountCode: nullableString,
  accountName: nullableString,
});

/** A single posting-role to ledger-account binding. */
export interface PostingAccountMapping {
  /** The posting role this binding configures. */
  role: PostingRole;
  /** Whether the account is an explicit mapping or a built-in default. */
  source: PostingAccountSource;
  /** UUID of the bound ledger account. */
  accountId: string;
  /** Human-facing account code (e.g. `'1100'`). */
  accountCode: string;
  /** Bound account name. */
  accountName: string;
}

/**
 * Parses a raw posting-account-mapping payload into a typed
 * {@link PostingAccountMapping}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `PostingAccountMapping`.
 * @throws {TypeError} If `accountId` is missing or not a non-empty string.
 */
export function parsePostingAccountMapping(json: unknown): PostingAccountMapping {
  const raw = PostingAccountMappingResponseSchema.parse(json);
  return {
    role: parsePostingRole(raw.role),
    source: parsePostingAccountSource(raw.source),
    accountId: parseUuid(raw.accountId, 'parsePostingAccountMapping.accountId'),
    accountCode: raw.accountCode ?? '',
    accountName: raw.accountName ?? '',
  };
}

/** Fields for creating or updating a posting-account mapping. */
export interface UpsertPostingAccountMappingRequest {
  /** UUID of the ledger account to bind to the role. */
  accountId: string;
}

/**
 * Serializes an {@link UpsertPostingAccountMappingRequest} into the backend
 * request body.
 *
 * @param dto - The upsert request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function upsertPostingAccountMappingToJson(
  dto: UpsertPostingAccountMappingRequest
): Record<string, unknown> {
  return { accountId: dto.accountId };
}
