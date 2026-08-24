/**
 * @module finance-settings-service
 *
 * Typed client for the organisation-level finance settings endpoints
 * (`/finance/settings/web`, resolved against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET /finance/settings/web` → `FinanceSettingsDto` (query)
 * - `PUT /finance/settings/web` → `FinanceSettingsDto` (full)
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  FinanceSettings,
  parseFinanceSettings,
  UpdateFinanceSettingsRequest,
  updateFinanceSettingsToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/settings/web';

/** Safely parse settings, converting parse failures into a 422 ApiError. */
function safeParseSettings(data: ApiResponse): FinanceSettings {
  try {
    return parseFinanceSettings(data);
  } catch (error) {
    logger.error('Failed to parse finance settings data:', error);
    throw new ApiError(
      'Failed to process finance settings data. Please try again.',
      422
    );
  }
}

/**
 * Finance Settings Service — organisation-level finance configuration.
 */
export const financeSettingsService = {
  /**
   * Fetches the finance settings.
   *
   * `GET /finance/settings/web`
   *
   * @returns The {@link FinanceSettings}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async get(): Promise<FinanceSettings> {
    const data = await api.get<ApiResponse>(BASE);
    return safeParseSettings(data);
  },

  /**
   * Updates the finance settings.
   *
   * `PUT /finance/settings/web` → `FinanceSettingsDto` (full).
   *
   * @param dto - The updated settings ({@link UpdateFinanceSettingsRequest}).
   * @returns The updated {@link FinanceSettings}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(dto: UpdateFinanceSettingsRequest): Promise<FinanceSettings> {
    const data = await api.put<ApiResponse>(
      BASE,
      updateFinanceSettingsToJson(dto)
    );
    return safeParseSettings(data);
  },
};
