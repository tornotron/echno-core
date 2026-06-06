/**
 * @module types/issue/issue-create
 *
 * Request shapes and serializers for creating an {@link Issue} and an
 * {@link IssueComment}.
 */
import { IssueType } from './issue-type';
import { IssueStatus } from './issue-status';

/**
 * Payload accepted by the issue create endpoint.
 *
 * Field-name mapping on the wire:
 * - `issueType` ↔ backend `issueType` (matches)
 * - `creatorId` → backend `createdById`
 * - `assigneeId` → backend `assignedToId`
 */
export interface CreateIssueRequest {
  /** Short human-readable summary. */
  title: string;

  /** Optional long-form description. */
  description?: string;

  /** Domain category — required by the backend. */
  issueType: IssueType;

  /** Optional initial lifecycle state; the backend supplies a default if omitted. */
  status?: IssueStatus;

  /** Optional priority label (free-form string at the moment). */
  priority?: string;

  /** Required project ID — issues always belong to a project. */
  projectId: number;

  /** Optional parent task ID; omit for project-scoped issues. */
  taskId?: number;

  /** Employee ID of the creator. */
  creatorId: number;

  /** Optional initial assignee. */
  assigneeId?: number;

  /** Optional due date for the issue. */
  dueDate?: Date;
}

/**
 * Serializes a {@link CreateIssueRequest} into the wire shape expected by
 * the backend. Optional fields are omitted from the payload when undefined
 * so the backend can apply its own defaults.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend's expected request body shape.
 */
export function createIssueToJson(
  dto: CreateIssueRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: dto.title,
    issueType: dto.issueType,
    projectId: dto.projectId,
    createdById: dto.creatorId,
  };

  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.priority !== undefined) payload.priority = dto.priority;
  if (dto.taskId !== undefined) payload.taskId = dto.taskId;
  if (dto.assigneeId !== undefined) payload.assignedToId = dto.assigneeId;
  if (dto.dueDate !== undefined) payload.dueDate = dto.dueDate.toISOString();

  return payload;
}

/**
 * Payload accepted by the issue-comment create endpoint.
 */
export interface CreateIssueCommentRequest {
  /** Parent issue ID. */
  issueId: number;

  /** The comment body. */
  comment: string;

  /** Employee ID of the comment author. */
  authorId: number;
}

/**
 * Serializes a {@link CreateIssueCommentRequest} for transmission to the
 * backend.
 *
 * @param dto - The create-comment request to serialize.
 * @returns A plain object matching the backend's expected request body shape.
 */
export function createIssueCommentToJson(
  dto: CreateIssueCommentRequest
): Record<string, unknown> {
  return {
    issueId: dto.issueId,
    comment: dto.comment,
    authorId: dto.authorId,
  };
}
