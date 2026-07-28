/**
 * @module finance-reports-service
 *
 * Typed client for the finance report endpoints (`/finance/reports/web`,
 * resolved against the `/api/v1` base). All endpoints are read-only.
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET /finance/reports/web/trial-balance?asOfDate`         → `TrialBalanceReport`  (query)
 * - `GET /finance/reports/web/profit-and-loss?fromDate&toDate` → `ProfitAndLossReport` (query)
 * - `GET /finance/reports/web/balance-sheet?asOfDate`         → `BalanceSheetReport`   (query)
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  TrialBalanceReport,
  parseTrialBalanceReport,
  ProfitAndLossReport,
  parseProfitAndLossReport,
  BalanceSheetReport,
  parseBalanceSheetReport,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/reports/web';

/**
 * Finance Reports Service — trial balance, profit-and-loss, and balance sheet.
 */
export const financeReportsService = {
  /**
   * Fetches a trial balance as of a date.
   *
   * `GET /finance/reports/web/trial-balance?asOfDate={asOfDate}`
   *
   * @param asOfDate - As-of date (`YYYY-MM-DD`).
   * @returns The {@link TrialBalanceReport}.
   * @throws {ApiError} On non-2xx responses or if the report fails to parse.
   */
  async trialBalance(asOfDate: string): Promise<TrialBalanceReport> {
    const data = await api.get<ApiResponse>(`${BASE}/trial-balance`, {
      asOfDate,
    });
    try {
      return parseTrialBalanceReport(data);
    } catch (error) {
      logger.error('Failed to parse trial balance report:', error);
      throw new ApiError(
        'Failed to process trial balance. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches a profit-and-loss report over a date range.
   *
   * `GET /finance/reports/web/profit-and-loss?fromDate={fromDate}&toDate={toDate}`
   *
   * @param fromDate - Range start (`YYYY-MM-DD`).
   * @param toDate - Range end (`YYYY-MM-DD`).
   * @returns The {@link ProfitAndLossReport}.
   * @throws {ApiError} On non-2xx responses or if the report fails to parse.
   */
  async profitAndLoss(
    fromDate: string,
    toDate: string
  ): Promise<ProfitAndLossReport> {
    const data = await api.get<ApiResponse>(`${BASE}/profit-and-loss`, {
      fromDate,
      toDate,
    });
    try {
      return parseProfitAndLossReport(data);
    } catch (error) {
      logger.error('Failed to parse profit-and-loss report:', error);
      throw new ApiError(
        'Failed to process profit-and-loss. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches a balance sheet as of a date.
   *
   * `GET /finance/reports/web/balance-sheet?asOfDate={asOfDate}`
   *
   * @param asOfDate - As-of date (`YYYY-MM-DD`).
   * @returns The {@link BalanceSheetReport}.
   * @throws {ApiError} On non-2xx responses or if the report fails to parse.
   */
  async balanceSheet(asOfDate: string): Promise<BalanceSheetReport> {
    const data = await api.get<ApiResponse>(`${BASE}/balance-sheet`, {
      asOfDate,
    });
    try {
      return parseBalanceSheetReport(data);
    } catch (error) {
      logger.error('Failed to parse balance sheet report:', error);
      throw new ApiError(
        'Failed to process balance sheet. Please try again.',
        422
      );
    }
  },
};
