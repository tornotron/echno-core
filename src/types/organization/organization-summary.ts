/**
 * @module organization-summary
 *
 * The scalar half of an organization, as `GET /organization/web/summary`
 * returns it (`OrganizationSimpleDto`). Carries what a picker or a list
 * row needs: id, name, contact fields, active flag. It does not carry
 * `employees`, `projects` or `attachments`, so nothing here can be
 * counted or rendered from those; a screen that needs them stays on the
 * full {@link Organization}.
 */

import { z } from 'zod';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableBoolean,
  nullableNumber,
  nullableString,
  opaque,
} from '../../lib/validation/backend-schema';

const OrganizationSummaryResponseSchema = z.object({
  id: opaque,
  organizationName: nullableString,
  organizationAddress: nullableString,
  organizationEmail: nullableString,
  organizationPhone: nullableString,
  organizationWebsite: nullableString,
  organizationLogo: nullableString,
  creatorId: nullableNumber,
  createdAt: backendDate,
  isActive: nullableBoolean,
});

/**
 * An organization without its contents.
 *
 * Every field here is also on {@link Organization} with the same type, so a
 * full `Organization` is assignable wherever an `OrganizationSummary` is
 * expected. The reverse is not true: the summary has no nested arrays and
 * no derived `logo` attachment.
 */
export interface OrganizationSummary {
  /** Unique surrogate identifier. */
  id: number;
  /** Display name of the organization. */
  organizationName: string;
  /** Physical address of the organization. */
  organizationAddress: string;
  /** Primary contact email address. */
  organizationEmail: string;
  /** Primary contact phone number. */
  organizationPhone: string;
  /** Optional public website URL. */
  organizationWebsite?: string;
  /**
   * The `organizationLogo` column as the backend stores it. The web app
   * uploads logos as `ORGANIZATION_LOGO` attachments instead, which only the
   * full {@link Organization} carries, so this is usually absent.
   */
  organizationLogo?: string;
  /** ID of the user who created this organization. */
  creatorId: number;
  /** Timestamp when the organization record was created. */
  createdAt?: Date;
  /** Whether this organization is currently active. */
  isActive: boolean;
}

/**
 * Parses one `OrganizationSimpleDto` payload into an
 * {@link OrganizationSummary}. Non-strict: unknown keys are ignored and
 * absent scalars fall back to the same defaults `parseOrganization` uses.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `OrganizationSummary`.
 * @throws {Error} If `id` is not a positive integer.
 */
export function parseOrganizationSummary(json: unknown): OrganizationSummary {
  const raw = OrganizationSummaryResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseOrganizationSummary.id'),
    organizationName: raw.organizationName ?? '',
    organizationAddress: raw.organizationAddress ?? '',
    organizationEmail: raw.organizationEmail ?? '',
    organizationPhone: raw.organizationPhone ?? '',
    organizationWebsite: raw.organizationWebsite ?? undefined,
    organizationLogo: raw.organizationLogo ?? undefined,
    creatorId: raw.creatorId ?? 0,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    isActive: raw.isActive ?? true,
  };
}
