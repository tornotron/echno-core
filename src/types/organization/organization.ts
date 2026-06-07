import { Employee, employeeToJson, parseEmployee } from '../employee';
import { Project, projectToJson, parseProject } from '../project';
import { Attachment, parseAttachment } from '../attachment';
import { parsePositiveInt } from '../../lib/utils/parse-id';

export interface Organization {
  id: number;
  organizationName: string;
  organizationAddress: string;
  organizationEmail: string;
  organizationPhone: string;
  organizationWebsite?: string;
  employees?: Employee[];
  projects?: Project[];
  creatorId: number;
  createdAt?: Date;
  isActive: boolean;

  // Attachments from backend
  attachments?: Attachment[];

  // Computed field for backward compatibility (populated from attachments)
  logo?: Attachment;
}

/** -------------------------------------------------------------
 *  Helper Functions
 *  ------------------------------------------------------------- */

/**
 * Get organization logo from attachments
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

/** Full JSON (for UI / debug) */
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
