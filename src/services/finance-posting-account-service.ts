/**
 * @module finance-posting-account-service
 *
 * Typed client for the finance posting-account mapping endpoints
 * (`/finance/posting-accounts/web`, resolved against the `/api/v1` base).
 *
 * A posting-account mapping binds a {@link PostingRole} to a ledger account so
 * the backend knows which account to post to when a document hits the general
 * ledger.
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET    /finance/posting-accounts/web`          → `PostingAccountMappingDto[]` (query)
 * - `PUT    /finance/posting-accounts/web/{role}`   → `PostingAccountMappingDto`   (full)
 * - `DELETE /finance/posting-accounts/web/{role}`   → `PostingAccountMappingDto`   (full; the reset default)
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  PostingRole,
  PostingAccountMapping,
  parsePostingAccountMapping,
  UpsertPostingAccountMappingRequest,
  upsertPostingAccountMappingToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/posting-accounts/web';

/** Safely parse a mapping, converting parse failures into a 422 ApiError. */
function safeParseMapping(data: ApiResponse): PostingAccountMapping {
  try {
    return parsePostingAccountMapping(data);
  } catch (error) {
    logger.error('Failed to parse posting-account mapping data:', error);
    throw new ApiError(
      'Failed to process posting-account mapping data. Please try again.',
      422
    );
  }
}

/** Safely parse a mapping array. */
function safeParseMappings(data: ApiResponse[]): PostingAccountMapping[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parsePostingAccountMapping(item));
  } catch (error) {
    logger.error('Failed to parse posting-account mappings data:', error);
    throw new ApiError(
      'Failed to process posting-account mappings data. Please try again.',
      422
    );
  }
}

/**
 * Finance Posting-Account Service — posting-role to ledger-account bindings.
 */
export const financePostingAccountService = {
  /**
   * Lists the posting-account mappings for every role.
   *
   * `GET /finance/posting-accounts/web`
   *
   * @returns The {@link PostingAccountMapping} records (one per resolved role).
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async list(): Promise<PostingAccountMapping[]> {
    const data = await api.get<ApiResponse[]>(BASE);
    return safeParseMappings(data);
  },

  /**
   * Creates or updates the mapping for a posting role.
   *
   * `PUT /finance/posting-accounts/web/{role}` → `PostingAccountMappingDto` (full).
   *
   * @param role - The posting role to bind.
   * @param dto - The account to bind ({@link UpsertPostingAccountMappingRequest}).
   * @returns The upserted {@link PostingAccountMapping}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async upsert(
    role: PostingRole,
    dto: UpsertPostingAccountMappingRequest
  ): Promise<PostingAccountMapping> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${encodeURIComponent(role)}`,
      upsertPostingAccountMappingToJson(dto)
    );
    return safeParseMapping(data);
  },

  /**
   * Deletes the explicit mapping for a posting role, reverting it to the
   * built-in default account.
   *
   * `DELETE /finance/posting-accounts/web/{role}` → `PostingAccountMappingDto`
   * (full; the resulting `DEFAULT`-source binding).
   *
   * @param role - The posting role to reset.
   * @returns The {@link PostingAccountMapping} after the reset.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async remove(role: PostingRole): Promise<PostingAccountMapping> {
    const data = await api.delete<ApiResponse>(
      `${BASE}/${encodeURIComponent(role)}`
    );
    return safeParseMapping(data);
  },
};
