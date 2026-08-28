/**
 * @module types/issue/issue-update
 *
 * Request shapes and serializers for updating an {@link Issue} and an
 * {@link IssueComment}.
 */
import { IssueType } from './issue-type';
import { IssueStatus } from './issue-status';

/**
 * Partial-update payload for an issue. Every field is optional; only the
 * fields the caller sets are sent to the backend.
 *
 * Wire-shape mapping:
 * - `assigneeId` → backend `assignedToId` (with `null` meaning "unassign").
 *
 * There is deliberately no due date; see {@link CreateIssueRequest}.
 */
export interface UpdateIssueRequest {
  /** New title, if changing. */
  title?: string;

  /** New description, if changing. */
  description?: string;

  /** New domain category, if changing. */
  issueType?: IssueType;

  /** New lifecycle state, if changing. */
  status?: IssueStatus;

  /** New priority label, if changing. */
  priority?: string;

  /** New assignee employee ID; pass `null` to explicitly unassign. */
  assigneeId?: number | null;
}

/**
 * Serializes an {@link UpdateIssueRequest} for transmission to the
 * backend. Undefined fields are omitted so the backend interprets the
 * payload as a partial update.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object containing only the fields the caller set.
 */
export function updateIssueToJson(
  dto: UpdateIssueRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (dto.title !== undefined) payload.title = dto.title;
  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.issueType !== undefined) payload.issueType = dto.issueType;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.priority !== undefined) payload.priority = dto.priority;
  if (dto.assigneeId !== undefined) payload.assignedToId = dto.assigneeId;

  return payload;
}

/**
 * Partial-update payload for an issue comment. Only `comment` is updatable.
 *
 * Note: the backend has no PATCH endpoint for issue comments at present;
 * `issueCommentService.update` will 404/405. The shape is preserved for
 * the day the endpoint lands.
 */
export interface UpdateIssueCommentRequest {
  /** New comment body. */
  comment: string;
}

/**
 * Serializes an {@link UpdateIssueCommentRequest} for transmission to the
 * backend.
 *
 * @param dto - The update-comment request to serialize.
 * @returns A plain object matching the backend's expected request body shape.
 */
export function updateIssueCommentToJson(
  dto: UpdateIssueCommentRequest
): Record<string, unknown> {
  return { comment: dto.comment };
}
