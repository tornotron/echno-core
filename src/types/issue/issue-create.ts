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
 * - `issueType` → backend `type`
 * - `assigneeId` → backend `assignedToId`
 *
 * There is deliberately no creator. The backend stamps it from the signed-in
 * session (echno-backend #598), `IssueCreationDto` no longer declares
 * `createdById`, and a caller cannot raise an issue in somebody else's name.
 *
 * The first line used to claim `issueType` matched the backend, which was wrong twice
 * over: the field is `type` there, and nothing had ever checked. Create worked anyway,
 * because `IssueCreationDto` carries `@JsonAlias("issueType")` and a bean-bound body
 * honours it. The update path takes a `Map` and switches over its keys, where there is
 * no property for an alias to attach to, so the same name that worked here was dropped
 * there and changing an issue's type through the product did nothing. Both paths now
 * send the canonical name.
 *
 * There is deliberately no due date. `IssueCreationDto` has no such field, the
 * `Issue` entity has no such column, and Spring ignores unknown properties, so
 * one sent here would be accepted and discarded.
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

  /**
   * Not sent. An issue hangs off a task, and the backend walks
   * {@link taskId} to the task's project rather than reading a project
   * from the body; `IssueCreationDto` has no such field. It stays on this
   * interface because the client still routes on it: `useCreateIssue`
   * reads it to append the new issue to the right project's cached list.
   *
   * @deprecated Not part of the request body. Used only client-side.
   */
  projectId?: number;

  /** Optional parent task ID; omit for project-scoped issues. */
  taskId?: number;

  /** Optional initial assignee. */
  assigneeId?: number;
}

/**
 * Serializes a {@link CreateIssueRequest} into the wire shape expected by
 * the backend. Optional fields are omitted from the payload when undefined
 * so the backend can apply its own defaults.
 *
 * `projectId` is deliberately left out: the backend reads the project off
 * the parent task, and the value serves the client's own cache routing.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend's expected request body shape.
 */
export function createIssueToJson(
  dto: CreateIssueRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: dto.title,
    type: dto.issueType,
  };

  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.priority !== undefined) payload.priority = dto.priority;
  if (dto.taskId !== undefined) payload.taskId = dto.taskId;
  if (dto.assigneeId !== undefined) payload.assignedToId = dto.assigneeId;

  return payload;
}

/**
 * Payload accepted by the issue-comment create endpoint.
 *
 * There is deliberately no author. The backend stamps it from the signed-in
 * session (echno-backend #598) and `IssueCommentCreationDto` no longer declares
 * `authorId`, so a comment cannot be posted under another name.
 */
export interface CreateIssueCommentRequest {
  /** Parent issue ID. */
  issueId: number;

  /** The comment body. */
  comment: string;
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
  };
}
