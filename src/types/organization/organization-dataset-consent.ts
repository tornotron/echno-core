/**
 * @module organization-dataset-consent
 *
 * Per-organization consent to the export of inspection evidence into the
 * construction image dataset. Off by default; the export job includes an
 * organization only while the flag is true.
 */

import { z } from 'zod';

const datasetConsentSchema = z.object({
  organizationId: z.number().int(),
  datasetConsent: z.boolean().default(false),
});

/** The dataset-consent flag as stored for one organization. */
export interface DatasetConsent {
  /** The organization the flag belongs to. */
  organizationId: number;
  /** True when the client has given written consent. */
  datasetConsent: boolean;
}

/** Body of `PUT /organization/web/{id}/dataset-consent`. */
export interface DatasetConsentUpdateRequest {
  /** True to record written consent, false to withdraw it. */
  datasetConsent: boolean;
}

/**
 * Parses a raw `DatasetConsentDto` body. Absent `datasetConsent` reads as
 * false, matching the backend default.
 *
 * @throws {ZodError} When `organizationId` is missing or not an integer.
 */
export function parseDatasetConsent(data: unknown): DatasetConsent {
  return datasetConsentSchema.parse(data);
}

/** Serializes a {@link DatasetConsentUpdateRequest} to the backend field name. */
export function datasetConsentUpdateToJson(
  dto: DatasetConsentUpdateRequest
): Record<string, unknown> {
  return { datasetConsent: dto.datasetConsent };
}
