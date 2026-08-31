/**
 * @module project-create
 *
 * Request payload for `POST /project/web` (and the multipart variant
 * `createWithFiles`). Domain field names mirror {@link Project}.
 */
import { toLocalDateAtMidnight } from '../../lib/utils/date-helpers';
import { ProjectStatus } from './project-status';
import { ProjectType } from './project-type';

/**
 * Fields accepted by the backend when creating a new {@link Project}.
 *
 * `Date` values are serialized to ISO-8601 strings by
 * {@link createProjectToJson}.
 */
export interface CreateProjectRequest {
  /** Display name of the project. Required. */
  projectName: string;

  /** Street address of the site, as one line. Required. */
  projectAddress: string;

  /** Town or city the site is in. Optional. */
  projectCity?: string;

  /**
   * Indian state or union territory the site is in. Optional, but it is what
   * compliance generation keys its rules by: without it the backend falls back
   * to reading a state out of the address, which finds nothing in an address
   * that names only a city. The backend stores it in its canonical spelling
   * and rejects a value that is not a state.
   */
  projectState?: string;

  /** Postal (PIN) code of the site. Optional. */
  projectPostalCode?: string;

  /** Free-text description. Optional. */
  description?: string;

  /**
   * Initial lifecycle state. Defaults server-side to
   * {@link ProjectStatus.upcoming} when omitted.
   */
  status?: ProjectStatus;

  /** Site longitude in decimal degrees. */
  projectLongitude?: number;

  /** Site latitude in decimal degrees. */
  projectLatitude?: number;

  /**
   * Not sent, and deliberately not honoured. `ProjectService` takes the
   * owning organization from the tenant on the request context, which is
   * derived from the caller's token. A backend that read this instead would
   * let any caller file a project into an organization they are not in, so
   * the right answer here is the client stopping rather than the server
   * starting.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  organizationId?: number;

  /** Planned start date. Serialized to ISO-8601. */
  startDate?: Date;

  /** Planned end date. Serialized to ISO-8601. */
  endDate?: Date;

  /** Project category used for compliance analysis and reporting. Optional. */
  projectType?: ProjectType;

  /**
   * Not sent. `ProjectCreationDto` has no member list, so the ids used to
   * go out under `employees` and land nowhere. Membership is its own pair
   * of routes: add each member with
   * {@link projectService.addEmployee} once the project exists.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  memberIds?: number[];
}

/**
 * Serializes a {@link CreateProjectRequest} into the JSON body accepted
 * by `POST /project/web`.
 *
 * Only set fields are included in the payload, so the backend can
 * distinguish "not set" from "explicitly null". `Date` fields are
 * converted to ISO-8601 strings.
 *
 * Two keys are deliberately left out. `organizationId` is the tenant, and
 * the server takes that from the request context rather than the body.
 * `memberIds` used to travel as `employees`, which `ProjectCreationDto`
 * has no field for; members go through
 * {@link projectService.addEmployee} instead.
 *
 * @param dto - The domain create request.
 * @returns A plain object matching the backend's request-body schema.
 */
export function createProjectToJson(
  dto: CreateProjectRequest
): Record<string, unknown> {
  return {
    projectName: dto.projectName,
    projectAddress: dto.projectAddress,
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
