import { IssueType } from './issue-type';
import { IssueStatus } from './issue-status';

export interface CreateIssueRequest {
  title: string;
  description?: string;
  issueType: IssueType;
  status?: IssueStatus;
  priority?: string;
  projectId: number;
  taskId?: number;
  creatorId: number;
  assigneeId?: number;
  dueDate?: Date;
}

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

export interface CreateIssueCommentRequest {
  issueId: number;
  comment: string;
  authorId: number;
}

export function createIssueCommentToJson(
  dto: CreateIssueCommentRequest
): Record<string, unknown> {
  return {
    issueId: dto.issueId,
    comment: dto.comment,
    authorId: dto.authorId,
  };
}
