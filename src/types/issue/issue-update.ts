import { IssueType } from './issue-type';
import { IssueStatus } from './issue-status';

export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  issueType?: IssueType;
  status?: IssueStatus;
  priority?: string;
  assigneeId?: number | null;
  dueDate?: Date;
}

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
  if (dto.dueDate !== undefined) payload.dueDate = dto.dueDate.toISOString();

  return payload;
}

export interface UpdateIssueCommentRequest {
  comment: string;
}

export function updateIssueCommentToJson(
  dto: UpdateIssueCommentRequest
): Record<string, unknown> {
  return { comment: dto.comment };
}
