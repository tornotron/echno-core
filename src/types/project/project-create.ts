/**
 * @module project-create
 *
 * Request payload for `POST /project/web` (and the multipart variant
 * `createWithFiles`). Domain field names mirror {@link Project}; the
 * serializer renames `memberIds` to the backend field `employees`.
 */
import { ProjectStatus } from './project-status';

/**
 * Fields accepted by the backend when creating a new {@link Project}.
 *
 * `Date` values are serialized to ISO-8601 strings by
 * {@link createProjectToJson}; `memberIds` is renamed to `employees` to
 * match the backend schema.
 */
export interface CreateProjectRequest {
  /** Display name of the project. Required. */
  projectName: string;

  /** Site address shown on dashboards and detail pages. Required. */
  projectAddress: string;

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
   * Owning organization. When omitted, the backend infers the value from
   * the authenticated user's primary organization.
   */
  organizationId?: number;

  /** Planned start date. Serialized to ISO-8601. */
  startDate?: Date;

  /** Planned end date. Serialized to ISO-8601. */
  endDate?: Date;

  /**
   * Employee IDs to add as initial members. Serialized under the
   * backend field name `employees`.
   */
  memberIds?: number[];
}

/**
 * Serializes a {@link CreateProjectRequest} into the JSON body accepted
 * by `POST /project/web`.
 *
 * Only set fields are included in the payload, so the backend can
 * distinguish "not set" from "explicitly null". `Date` fields are
 * converted to ISO-8601 strings; `memberIds` is renamed to `employees`.
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
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.status !== undefined && { status: dto.status }),
    ...(dto.projectLongitude !== undefined && {
      projectLongitude: dto.projectLongitude,
    }),
    ...(dto.projectLatitude !== undefined && {
      projectLatitude: dto.projectLatitude,
    }),
    ...(dto.organizationId !== undefined && {
      organizationId: dto.organizationId,
    }),
    ...(dto.startDate !== undefined && {
      startDate: dto.startDate.toISOString(),
    }),
    ...(dto.endDate !== undefined && { endDate: dto.endDate.toISOString() }),
    ...(dto.memberIds !== undefined && { employees: dto.memberIds }),
  };
}
