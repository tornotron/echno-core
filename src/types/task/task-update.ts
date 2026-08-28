/**
 * @module task-update
 *
 * Partial update payload for `PATCH /tasks/web/{id}` (multipart). Every
 * field is optional — callers send only the keys they want to change.
 */
import { toLocalDateAtMidnight } from '../../lib/utils/date-helpers';
import { TaskStatus } from './task-status';

/**
 * Partial update payload for an existing {@link Task}.
 *
 * Every field is optional; absent fields are left unchanged on the
 * server. `Date` values are serialized to ISO-8601 strings by
 * {@link updateTaskToJson}. Joined entities are referenced by ID
 * rather than nested objects.
 *
 * Backend responds with `TaskSimpleDto` — `creator`, `assignees`,
 * `category`, `issues`, and `attachments` are absent. Cache consumers
 * must merge into prior detail rather than overwrite.
 */
export interface UpdateTaskRequest {
  /** New title. */
  title?: string;

  /** Move the task under a different project. */
  projectId?: number;

  /** New description. */
  description?: string;

  /** New planned start date. */
  startDate?: Date;

  /** New planned end date. */
  endDate?: Date;

  /** New creator employee ID. */
  creatorId?: number;

  /** New work category ID. */
  categoryId?: number;

  /** New lifecycle state. */
  status?: TaskStatus;

  /** New progress value. */
  progress?: number;

  /** Replacement tag list. */
  tags?: string[];

  /** Replacement assignee list. */
  assigneeIds?: number[];

  /** New priority bucket. Lives only on the request DTO. */
  priority?: string;
}

/**
 * Serializes an {@link UpdateTaskRequest} into the JSON body accepted by
 * `PATCH /tasks/web/{id}`.
 *
 * Only set fields are emitted so the backend can distinguish "not set"
 * from "explicitly null". `Date` fields are converted to ISO-8601
 * strings.
 *
 * @param dto - The domain update request.
 * @returns A plain object matching the backend's request-body schema.
 */
export function updateTaskToJson(
  dto: UpdateTaskRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (dto.title !== undefined) payload.title = dto.title;
  if (dto.projectId !== undefined) payload.projectId = dto.projectId;
  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.startDate !== undefined)
    payload.startDate = toLocalDateAtMidnight(dto.startDate);
  if (dto.endDate !== undefined) payload.endDate = toLocalDateAtMidnight(dto.endDate);
  if (dto.creatorId !== undefined) payload.creatorId = dto.creatorId;
  if (dto.categoryId !== undefined) payload.categoryId = dto.categoryId;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.progress !== undefined) payload.progress = dto.progress;
  if (dto.tags !== undefined) payload.tags = dto.tags;
  if (dto.assigneeIds !== undefined) payload.assigneeIds = dto.assigneeIds;
  if (dto.priority !== undefined) payload.priority = dto.priority;

  return payload;
}
