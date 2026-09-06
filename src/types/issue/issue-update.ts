/**
 * @module types/issue/issue-update
 *
 * Request shape and serializer for updating an {@link Issue}.
 *
 * There is no counterpart for an issue comment. A comment can be posted and
 * deleted, and nothing else: neither issue-comment controller publishes a
 * PATCH or a PUT, and `IssueCommentService` has no update method. This module
 * used to carry an `UpdateIssueCommentRequest` and its serializer for a route
 * that was never written. Whether a comment should be editable at all is
 * echno-backend#676.
 */
import { IssuePriority } from './issue-priority';
import { IssueType } from './issue-type';
import { IssueStatus } from './issue-status';

/**
 * Partial-update payload for an issue. Every field is optional; only the
 * fields the caller sets are sent to the backend.
 *
 * Wire-shape mapping:
 * - `issueType` → backend `type`.
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

  /**
   * New urgency, if changing. `null` clears it: the column is nullable and the
   * update endpoint accepts an explicit null there, unlike `type` and
   * `status`, which refuse one.
   */
  priority?: IssuePriority | null;

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
  if (dto.issueType !== undefined) payload.type = dto.issueType;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.priority !== undefined) payload.priority = dto.priority;
  if (dto.assigneeId !== undefined) payload.assignedToId = dto.assigneeId;

  return payload;
}

