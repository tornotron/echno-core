/**
 * @module organization
 *
 * Core `Organization` domain type, JSON parser, and serializer.
 *
 * Handles the API response shape — including the nested `employees`,
 * `projects`, and `attachments` arrays — and exposes the computed
 * `logo` convenience field.
 */

import { Employee, employeeToJson, parseEmployee } from '../employee';
import { Project, projectToJson, parseProject } from '../project';
import { Attachment, parseAttachment } from '../attachment';
import { parsePositiveInt } from '../../lib/utils/parse-id';

/**
 * Represents an organization in the Echno system.
 *
 * The `employees`, `projects`, and `attachments` nested arrays are absent on
 * partial backend responses (e.g. `OrganizationSimpleDto`). Callers that need
 * nested data should use the full detail endpoint.
 */
export interface Organization {
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
  /** Employees belonging to this organization. Absent on partial responses. */
  employees?: Employee[];
  /** Projects associated with this organization. Absent on partial responses. */
  projects?: Project[];
  /** ID of the user who created this organization. */
  creatorId: number;
  /** Timestamp when the organization record was created. */
  createdAt?: Date;
  /** Whether this organization is currently active. */
  isActive: boolean;

  /** Attachment records for this organization. Absent on partial responses. */
  attachments?: Attachment[];

  /**
   * Convenience reference to the organization's logo attachment.
   * Populated from `attachments` filtered by `entityType === 'ORGANIZATION_LOGO'`.
   */
  logo?: Attachment;
}

/** -------------------------------------------------------------
 *  Helper Functions
 *  ------------------------------------------------------------- */

/**
 * Returns the logo attachment for the given organization.
 *
 * Checks `org.logo` first, then falls back to scanning `org.attachments`
 * for an entry with `entityType === 'ORGANIZATION_LOGO'`.
 *
 * @param org - The organization to inspect.
 * @returns The logo {@link Attachment}, or `undefined` if none exists.
 */
export function getOrganizationLogo(org: Organization): Attachment | undefined {
  return (
    org.logo ??
    org.attachments?.find((att) => att.entityType === 'ORGANIZATION_LOGO')
  );
}

/** -------------------------------------------------------------
 *  JSON → Organization
 *  ------------------------------------------------------------- */

/**
 * Parses a raw API payload into a typed {@link Organization}.
 *
 * Extracts the logo from `attachments` filtered by
 * `entityType === 'ORGANIZATION_LOGO'`, preferring the most recently
 * created one. Falls back to `json.logo` / `json.organizationLogo` for
 * older API response shapes.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `Organization` domain object.
 * @throws {Error} If `id` is not a positive integer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOrganization(json: any): Organization {
  // Parse attachments array from backend
  const attachments: Attachment[] | undefined = json.attachments
    ? (json.attachments as unknown[]).map((att) => parseAttachment(att))
    : undefined;

  // Extract logo - use latest by createdAt if multiple exist
  const logoAttachments = attachments?.filter(
    (att) => att.entityType === 'ORGANIZATION_LOGO'
  );
  const logo =
    logoAttachments && logoAttachments.length > 0
      ? logoAttachments.toSorted(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )[0]
      : // Fallback for old API responses
        (json.logo ?? json.organizationLogo)
        ? parseAttachment(json.logo ?? json.organizationLogo)
        : undefined;

  const id = parsePositiveInt(json.id, 'parseOrganization.id');

  return {
    id,
    organizationName: json.organizationName ?? '',
    organizationAddress: json.organizationAddress ?? '',
    organizationEmail: json.organizationEmail ?? '',
    organizationPhone: json.organizationPhone ?? '',
    organizationWebsite: json.organizationWebsite ?? undefined,
    employees: json.employees
      ? (json.employees as unknown[]).map((e) => parseEmployee(e))
      : undefined,
    projects: json.projects
      ? (json.projects as unknown[]).map((p) => parseProject(p))
      : undefined,
    creatorId: json.proprietorId ?? json.creatorId ?? 0,
    createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
    isActive: json.isActive ?? true,
    attachments,
    logo,
  };
}

/**
 * Serializes an {@link Organization} for transmission to the backend.
 *
 * Note: `logo` is excluded — logo uploads are handled via the multipart
 * endpoint using {@link OrganizationFiles}.
 *
 * @param org - The domain object to serialize.
 * @returns A plain object matching the backend's request body shape.
 */
export function organizationToJson(org: Organization): Record<string, unknown> {
  return {
    id: org.id,
    organizationName: org.organizationName,
    organizationAddress: org.organizationAddress,
    organizationEmail: org.organizationEmail,
    organizationPhone: org.organizationPhone,
    organizationWebsite: org.organizationWebsite,
    // Note: logo not sent - file uploads handled via multipart
    employees: org.employees?.map((e) => employeeToJson(e)),
    projects: org.projects?.map((p) => projectToJson(p)),
    creatorId: org.creatorId,
    createdAt: org.createdAt?.toISOString(),
    isActive: org.isActive,
  };
}
