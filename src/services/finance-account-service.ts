/**
 * @module finance-account-service
 *
 * Typed client for the finance chart-of-accounts endpoints
 * (`/finance/accounts/web`, resolved against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET  /finance/accounts/web`                    → `AccountDto[]`     (query)
 * - `POST /finance/accounts/web`                     → `AccountDto`       (full)
 * - `GET  /finance/accounts/web/tree`                → `AccountTreeDto[]` (query)
 * - `GET  /finance/accounts/web/{id}`                → `AccountDto`       (query)
 * - `GET  /finance/accounts/web/by-code/{code}`      → `AccountDto`       (query)
 * - `POST /finance/accounts/web/{id}/deactivate`     → `AccountDto`       (full)
 * - `PUT  /finance/accounts/web/{id}`                → `AccountDto`       (full)
 * - `GET  /finance/accounts/web/export`              → CSV file          (`text/csv` blob)
 * - `POST /finance/accounts/web/import`              → `CoaImportSummary` (multipart `file`)
 *
 * Each method wraps a lower-level `api.*` call and parses the raw JSON into a
 * strongly-typed domain object. Parse failures are logged and rethrown as
 * {@link ApiError} with status `422`; all methods also throw {@link ApiError}
 * on non-2xx HTTP responses.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Account,
  parseAccount,
  AccountTreeNode,
  parseAccountTree,
  CreateAccountRequest,
  createAccountToJson,
  UpdateAccountRequest,
  updateAccountToJson,
  CoaImportSummary,
  parseCoaImportSummary,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/accounts/web';

/** Safely parse an account, converting parse failures into a 422 ApiError. */
function safeParseAccount(data: ApiResponse): Account {
  try {
    return parseAccount(data);
  } catch (error) {
    logger.error('Failed to parse account data:', error);
    throw new ApiError('Failed to process account data. Please try again.', 422);
  }
}

/** Safely parse an account array. */
function safeParseAccounts(data: ApiResponse[]): Account[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseAccount(item));
  } catch (error) {
    logger.error('Failed to parse accounts data:', error);
    throw new ApiError(
      'Failed to process accounts data. Please try again.',
      422
    );
  }
}

/** Safely parse an account-tree array. */
function safeParseAccountTree(data: ApiResponse[]): AccountTreeNode[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseAccountTree(item));
  } catch (error) {
    logger.error('Failed to parse account tree data:', error);
    throw new ApiError(
      'Failed to process account tree data. Please try again.',
      422
    );
  }
}

/**
 * Finance Account Service — chart-of-accounts CRUD and hierarchy.
 */
export const financeAccountService = {
  /**
   * Lists ledger accounts.
   *
   * `GET /finance/accounts/web[?activeOnly]`
   *
   * @param activeOnly - When true, restrict to active accounts.
   * @returns The {@link Account} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async list(activeOnly?: boolean): Promise<Account[]> {
    const params =
      activeOnly === undefined ? undefined : { activeOnly };
    const data = await api.get<ApiResponse[]>(BASE, params);
    return safeParseAccounts(data);
  },

  /**
   * Fetches the full chart-of-accounts hierarchy.
   *
   * `GET /finance/accounts/web/tree`
   *
   * @returns The root {@link AccountTreeNode} records with nested children.
   * @throws {ApiError} On non-2xx responses or if a node fails to parse.
   */
  async getTree(): Promise<AccountTreeNode[]> {
    const data = await api.get<ApiResponse[]>(`${BASE}/tree`);
    return safeParseAccountTree(data);
  },

  /**
   * Fetches a single account by id.
   *
   * `GET /finance/accounts/web/{id}`
   *
   * @param id - UUID of the account.
   * @returns The {@link Account}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<Account> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseAccount(data);
  },

  /**
   * Fetches a single account by its code.
   *
   * `GET /finance/accounts/web/by-code/{code}`
   *
   * @param code - Account code.
   * @returns The {@link Account}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getByCode(code: string): Promise<Account> {
    const data = await api.get<ApiResponse>(
      `${BASE}/by-code/${encodeURIComponent(code)}`
    );
    return safeParseAccount(data);
  },

  /**
   * Creates a ledger account.
   *
   * `POST /finance/accounts/web` → `AccountDto` (full).
   *
   * @param dto - Account fields ({@link CreateAccountRequest}).
   * @returns The created {@link Account}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(dto: CreateAccountRequest): Promise<Account> {
    const data = await api.post<ApiResponse>(BASE, createAccountToJson(dto));
    return safeParseAccount(data);
  },

  /**
   * Deactivates a ledger account.
   *
   * `POST /finance/accounts/web/{id}/deactivate` → `AccountDto` (full).
   *
   * @param id - UUID of the account.
   * @returns The updated (deactivated) {@link Account}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async deactivate(id: string): Promise<Account> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/deactivate`, {});
    return safeParseAccount(data);
  },

  /**
   * Updates a ledger account.
   *
   * `PUT /finance/accounts/web/{id}` → `AccountDto` (full).
   *
   * @param id - UUID of the account.
   * @param dto - Updated account fields ({@link UpdateAccountRequest}).
   * @returns The updated {@link Account}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(id: string, dto: UpdateAccountRequest): Promise<Account> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}`,
      updateAccountToJson(dto)
    );
    return safeParseAccount(data);
  },

  /**
   * Exports the chart of accounts as a CSV file.
   *
   * `GET /finance/accounts/web/export` → `text/csv`.
   *
   * @returns The CSV payload as a {@link Blob} (the caller triggers the download).
   * @throws {ApiError} On non-2xx responses or network failure.
   */
  async exportChartOfAccounts(): Promise<Blob> {
    return api.getBlob(`${BASE}/export`);
  },

  /**
   * Imports a chart-of-accounts CSV file.
   *
   * `POST /finance/accounts/web/import` (multipart, field `file`) →
   * `CoaImportSummary`.
   *
   * @param file - The CSV file to import.
   * @returns The {@link CoaImportSummary} (created/updated counts + per-row errors).
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async importChartOfAccounts(file: File): Promise<CoaImportSummary> {
    const formData = new FormData();
    formData.append('file', file);
    const data = await api.postFormData<ApiResponse>(`${BASE}/import`, formData);
    try {
      return parseCoaImportSummary(data);
    } catch (error) {
      logger.error('Failed to parse CoA import summary:', error);
      throw new ApiError(
        'Failed to process import summary. Please try again.',
        422
      );
    }
  },
};
