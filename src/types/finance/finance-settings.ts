/**
 * @module types/finance/finance-settings
 *
 * Organisation-level finance settings ({@link FinanceSettings}, backend
 * `FinanceSettingsDto`) and its parser {@link parseFinanceSettings}, plus the
 * {@link UpdateFinanceSettingsRequest} write payload and its serializer.
 *
 * `approvalThreshold` is the monetary amount above which a document requires
 * approval; `null` means no threshold is configured (approval is not gated on
 * amount).
 */

import { z } from 'zod';
import { money } from '../../lib/validation/backend-schema';

const FinanceSettingsResponseSchema = z.object({
  approvalThreshold: money,
});

/** Organisation-level finance settings. */
export interface FinanceSettings {
  /** Amount above which approval is required, or `null` when unset. */
  approvalThreshold: number | null;
}

/**
 * Parses a raw finance-settings payload into a typed {@link FinanceSettings}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `FinanceSettings` (`approvalThreshold` is `null` when absent).
 */
export function parseFinanceSettings(json: unknown): FinanceSettings {
  const raw = FinanceSettingsResponseSchema.parse(json);
  return {
    approvalThreshold: raw.approvalThreshold ?? null,
  };
}

/** Fields for updating the finance settings. */
export interface UpdateFinanceSettingsRequest {
  /** New approval threshold, or `null` to clear it. */
  approvalThreshold: number | null;
}

/**
 * Serializes an {@link UpdateFinanceSettingsRequest} into the backend request
 * body. `approvalThreshold` is always emitted (a `null` explicitly clears it).
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updateFinanceSettingsToJson(
  dto: UpdateFinanceSettingsRequest
): Record<string, unknown> {
  return { approvalThreshold: dto.approvalThreshold };
}
