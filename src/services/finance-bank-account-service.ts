/**
 * @module finance-bank-account-service
 *
 * Typed client for the company-bank-account endpoints
 * (`/finance/company-bank-accounts/web`, resolved against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET  /finance/company-bank-accounts/web`                 → `CompanyBankAccountDto[]` (query)
 * - `POST /finance/company-bank-accounts/web`                 → `CompanyBankAccountDto`   (full)
 * - `GET  /finance/company-bank-accounts/web/{id}`            → `CompanyBankAccountDto`   (query)
 * - `POST /finance/company-bank-accounts/web/{id}/deactivate` → `CompanyBankAccountDto`   (full)
 *
 * NOTE: the OpenAPI spec currently exposes this controller under `/api/finance`
 * (no `/v1`). This client uses the `/finance/...` path (→ `/api/v1/finance/...`)
 * per the confirmed backend path-parity update. Verify at integration time.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  CompanyBankAccount,
  parseCompanyBankAccount,
  CreateCompanyBankAccountRequest,
  createCompanyBankAccountToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/company-bank-accounts/web';

/** Safely parse a company bank account, converting failures into a 422 ApiError. */
function safeParseBankAccount(data: ApiResponse): CompanyBankAccount {
  try {
    return parseCompanyBankAccount(data);
  } catch (error) {
    logger.error('Failed to parse company bank account data:', error);
    throw new ApiError(
      'Failed to process bank account data. Please try again.',
      422
    );
  }
}

/** Safely parse a company-bank-account array. */
function safeParseBankAccounts(data: ApiResponse[]): CompanyBankAccount[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseCompanyBankAccount(item));
  } catch (error) {
    logger.error('Failed to parse company bank accounts data:', error);
    throw new ApiError(
      'Failed to process bank accounts data. Please try again.',
      422
    );
  }
}

/**
 * Finance Company-Bank-Account Service — organization bank accounts linked to
 * GL ledger accounts.
 */
export const financeBankAccountService = {
  /**
   * Lists company bank accounts.
   *
   * `GET /finance/company-bank-accounts/web[?activeOnly]`
   *
   * @param activeOnly - When true, restrict to active accounts.
   * @returns The {@link CompanyBankAccount} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async list(activeOnly?: boolean): Promise<CompanyBankAccount[]> {
    const params = activeOnly === undefined ? undefined : { activeOnly };
    const data = await api.get<ApiResponse[]>(BASE, params);
    return safeParseBankAccounts(data);
  },

  /**
   * Fetches a single company bank account by id.
   *
   * `GET /finance/company-bank-accounts/web/{id}`
   *
   * @param id - UUID of the bank account.
   * @returns The {@link CompanyBankAccount}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<CompanyBankAccount> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseBankAccount(data);
  },

  /**
   * Creates a company bank account.
   *
   * `POST /finance/company-bank-accounts/web` → `CompanyBankAccountDto` (full).
   *
   * @param dto - Bank account fields ({@link CreateCompanyBankAccountRequest}).
   * @returns The created {@link CompanyBankAccount}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(
    dto: CreateCompanyBankAccountRequest
  ): Promise<CompanyBankAccount> {
    const data = await api.post<ApiResponse>(
      BASE,
      createCompanyBankAccountToJson(dto)
    );
    return safeParseBankAccount(data);
  },

  /**
   * Deactivates a company bank account.
   *
   * `POST /finance/company-bank-accounts/web/{id}/deactivate` →
   * `CompanyBankAccountDto` (full).
   *
   * @param id - UUID of the bank account.
   * @returns The updated (deactivated) {@link CompanyBankAccount}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async deactivate(id: string): Promise<CompanyBankAccount> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/deactivate`, {});
    return safeParseBankAccount(data);
  },
};
