// types/issue/issue.ts
import { IssueType, issueTypeFromString } from './issue-type';
import { IssueStatus, issueStatusFromString } from './issue-status';
import { IssueComment, parseIssueComment } from './issue-comment';
import { Attachment, parseAttachment } from '../attachment';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { Employee } from '../employee/employee';
import { parseUTCDate } from '../../lib/utils/date-helpers';

export interface Issue {
  id: number;
  taskId?: number;
  taskName?: string;
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  createdAt: Date;
  updatedAt?: Date;
  creatorId?: number;
  creator?: Employee; // resolved at hook level from creatorId
  assigneeId?: number | null;
  assignee?: Employee; // resolved at hook level from assigneeId
  comments?: IssueComment[];
  attachments?: Attachment[];
}

/** JSON → Issue
 *  API shape:
 *  { createdById, assignedToId, issueComments, taskName, ... }
 *  creator/assignee are NOT embedded — they are resolved by the hooks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseIssue(json: any): Issue {
  const id = parsePositiveInt(json.id, 'parseIssue.id');

  return {
    id,
    taskId: json.taskId ?? undefined,
    taskName: json.taskName ?? undefined,
    title: json.title ?? '',
    description: json.description ?? undefined,
    type: issueTypeFromString(json.type),
    status: issueStatusFromString(json.status),
    createdAt: parseUTCDate(json.createdAt) ?? new Date(),
    updatedAt: json.updatedAt
      ? (parseUTCDate(json.updatedAt) ?? undefined)
      : undefined,
    creatorId: json.createdById ?? undefined,
    assigneeId: json.assignedToId ?? undefined,
    comments: json.issueComments
      ? (json.issueComments as unknown[]).map((c) => parseIssueComment(c))
      : [],
    attachments: json.attachments
      ? (json.attachments as unknown[]).map((a) => parseAttachment(a))
      : [],
  };
}

/** Issue → JSON */
export function issueToJson(issue: Issue): Record<string, unknown> {
  return {
    id: issue.id,
    taskId: issue.taskId,
    title: issue.title,
    description: issue.description,
    type: issue.type,
    status: issue.status,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt?.toISOString(),
    createdById: issue.creatorId ?? issue.creator?.id,
    assignedToId: issue.assigneeId ?? issue.assignee?.id,
    // comments and attachments are not sent on update
  };
}

/** copyWith – immutable update */
export function copyIssue(
  issue: Issue,
  updates: Partial<
    Pick<
      Issue,
      'title' | 'description' | 'type' | 'status' | 'creator' | 'assignee'
    >
  >
): Issue {
  return {
    ...issue,
    ...updates,
  };
}

/** Equality (like Equatable) */
export function areIssuesEqual(a: Issue, b: Issue): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.description === b.description &&
    a.type === b.type &&
    a.status === b.status &&
    a.createdAt.getTime() === b.createdAt.getTime() &&
    a.updatedAt?.getTime() === b.updatedAt?.getTime() &&
    a.creatorId === b.creatorId &&
    a.assigneeId === b.assigneeId
  );
}
