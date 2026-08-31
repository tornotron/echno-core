/**
 * @module project-update
 *
 * Request payload for `PATCH /project/web/{id}` (and the multipart
 * variant `updateWithFiles`). Every field is optional — callers send
 * only the keys they want to change.
 */
import { toLocalDateAtMidnight } from '../../lib/utils/date-helpers';
import { ProjectStatus } from './project-status';
import { ProjectType } from './project-type';

/**
 * Partial update payload for an existing {@link Project}.
 *
 * Every field is optional; absent fields are left unchanged on the
 * server. `Date` values are serialized to ISO-8601 strings by
 * {@link updateProjectToJson}.
 *
 * Backend responds with `ProjectSimpleDto` (nested `attachments`,
 * `members`, and `tasks` arrays absent).
 */
export interface UpdateProjectRequest {
  /** New display name. */
  projectName?: string;

  /** New street address of the site, as one line. */
  projectAddress?: string;

  /** New town or city the site is in. */
  projectCity?: string;

  /**
   * New Indian state or union territory the site is in. Read by compliance
   * generation, which keys its rules by state; the backend stores it in its
   * canonical spelling and rejects a value that is not a state.
   */
  projectState?: string;

  /** New postal (PIN) code of the site. */
  projectPostalCode?: string;

  /** New description. */
  description?: string;

  /** New lifecycle state. */
  status?: ProjectStatus;

  /** New site longitude in decimal degrees. */
  projectLongitude?: number;

  /** New site latitude in decimal degrees. */
  projectLatitude?: number;

  /**
   * Not sent, and deliberately not honoured. A project's organization is
   * the tenant, and `ProjectService` reads that off the request context
   * rather than the body. A backend that applied this value would let a
   * caller move a project out of their own tenant, so the fix belongs on
   * the client and nowhere else. There is no move-between-organizations
   * operation.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  organizationId?: number;

  /** New planned start date. Serialized to ISO-8601. */
  startDate?: Date;

  /** New planned end date. Serialized to ISO-8601. */
  endDate?: Date;

  /** New project category used for compliance analysis and reporting. */
  projectType?: ProjectType;

  /**
   * Not sent. `ProjectUpdateFieldsDto` has no member list, so a
   * replacement list went out under `employees` and changed nothing.
   * Membership is edited one member at a time through
   * {@link projectService.addEmployee} and
   * {@link projectService.removeEmployee}, which is what the product
   * already uses.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  memberIds?: number[];
}

/**
 * Serializes an {@link UpdateProjectRequest} into the JSON body accepted
 * by `PATCH /project/web/{id}`.
 *
 * Only set fields are emitted so the backend can distinguish "not set"
 * from "explicitly null". `Date` fields are converted to ISO-8601
 * strings.
 *
 * `organizationId` and `memberIds` are deliberately left out: the tenant
 * comes off the request context, and members are edited through
 * {@link projectService.addEmployee} and
 * {@link projectService.removeEmployee}.
 *
 * @param dto - The domain update request.
 * @returns A plain object matching the backend's request-body schema.
 */
export function updateProjectToJson(
  dto: UpdateProjectRequest
): Record<string, unknown> {
  return {
    ...(dto.projectName !== undefined && { projectName: dto.projectName }),
    ...(dto.projectAddress !== undefined && {
      projectAddress: dto.projectAddress,
    }),
    ...(dto.projectCity !== undefined && { projectCity: dto.projectCity }),
    ...(dto.projectState !== undefined && { projectState: dto.projectState }),
    ...(dto.projectPostalCode !== undefined && {
      projectPostalCode: dto.projectPostalCode,
    }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.status !== undefined && { status: dto.status }),
    ...(dto.projectLongitude !== undefined && {
      projectLongitude: dto.projectLongitude,
    }),
    ...(dto.projectLatitude !== undefined && {
      projectLatitude: dto.projectLatitude,
    }),
    ...(dto.startDate !== undefined && {
      startDate: toLocalDateAtMidnight(dto.startDate),
    }),
    ...(dto.endDate !== undefined && { endDate: toLocalDateAtMidnight(dto.endDate) }),
    ...(dto.projectType !== undefined && { projectType: dto.projectType }),
  };
}
