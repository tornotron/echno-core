/**
 * @module task-create
 *
 * Request payload for `POST /tasks/web` (multipart) plus the
 * {@link TaskFiles} file-upload shape used by both create and update.
 */
import { toLocalDateAtMidnight } from '../../lib/utils/date-helpers';
import { TaskStatus } from './task-status';

/**
 * Fields accepted by the backend when creating a new {@link Task}.
 *
 * Joined entities are referenced by ID (`categoryId`,
 * `assigneeIds`) rather than nested objects; the server resolves them
 * and returns the populated entities on subsequent reads. `Date` values
 * are serialized to ISO-8601 strings by {@link createTaskToJson}.
 */
export interface CreateTaskRequest {
  /** Display title. Required. */
  title: string;

  /** Surrogate ID of the owning project. Required. */
  projectId: number;

  /** Free-text description. */
  description?: string;

  /** Planned start date. */
  startDate?: Date;

  /** Planned end date. */
  endDate?: Date;

  /** Surrogate ID of the work category. */
  categoryId?: number;

  /** Initial lifecycle state. */
  status?: TaskStatus;

  /** Initial progress as a number in `[0, 100]`. */
  progress?: number;

  /** Free-form labels. */
  tags?: string[];

  /** Surrogate IDs of employees to assign. */
  assigneeIds?: number[];

  /**
   * Not applied. There is no priority column on `Task`, no field on
   * `TaskCreationDto`, and no control anywhere in the client that sets one,
   * so this has never carried a value to anywhere.
   *
   * Note the contrast with issue priority, which reads the same on the
   * request-contract list and is not the same case: the issue form has a
   * priority control a user can see and use.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  priority?: string;
}

/**
 * Files uploaded alongside a task create or update request.
 *
 * Field names mirror the multipart form-field names accepted by the
 * backend (`/tasks/web`).
 */
export interface TaskFiles {
  /**
   * Attachments to upload with the task. Omit or pass an empty array
   * to leave existing attachments untouched on update.
   */
  attachments?: File[];
}

/**
 * Serializes a {@link CreateTaskRequest} into the JSON body accepted by
 * `POST /tasks/web`.
 *
 * Only set fields are included so the backend can distinguish "not set"
 * from "explicitly null". `Date` fields are converted to ISO-8601
 * strings.
 *
 * @param dto - The domain create request.
 * @returns A plain object matching the backend's request-body schema.
 */
export function createTaskToJson(
  dto: CreateTaskRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: dto.title,
    projectId: dto.projectId,
  };

  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.startDate !== undefined)
    payload.startDate = toLocalDateAtMidnight(dto.startDate);
  if (dto.endDate !== undefined) payload.endDate = toLocalDateAtMidnight(dto.endDate);
  if (dto.categoryId !== undefined) payload.categoryId = dto.categoryId;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.progress !== undefined) payload.progress = dto.progress;
  if (dto.tags !== undefined) payload.tags = dto.tags;
  if (dto.assigneeIds !== undefined) payload.assigneeIds = dto.assigneeIds;

  return payload;
}
