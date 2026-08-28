/**
 * @module types/issue/issue
 *
 * Domain type and JSON converters for an issue — a tracked work-blocker,
 * defect, or coordination item that may optionally belong to a {@link Task}
 * and always belongs to a project.
 */
import { z } from 'zod';
import { IssueType, issueTypeFromString } from './issue-type';
import { IssueStatus, issueStatusFromString } from './issue-status';
import { IssueComment, parseIssueComment } from './issue-comment';
import { Attachment, parseAttachment } from '../attachment';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { Employee } from '../employee/employee';
import {
  parseUTCDate,
  toLocalDateTimeString,
} from '../../lib/utils/date-helpers';
import {
  backendDate,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

/**
 * Shape of the backend issue payload at the parse boundary. `type` and
 * `status` are required strings — they feed the `fromString` mappers, which
 * already reject anything unknown. Nested arrays are handed to their own
 * parsers; the joined `creator` / `assignee` never appear on the payload.
 */
const IssueResponseSchema = z.object({
  id: opaque,
  taskId: optionalNumericId,
  taskName: nullableString,
  title: nullableString,
  description: nullableString,
  type: z.string(),
  status: z.string(),
  createdAt: backendDate,
  updatedAt: backendDate,
  createdById: optionalNumericId,
  assignedToId: optionalNumericId,
  issueComments: z.array(z.unknown()).nullish(),
  attachments: z.array(z.unknown()).nullish(),
});

/**
 * Represents a single issue.
 *
 * `creator` and `assignee` are populated at the hook layer from the flat
 * {@link Employee} cache via `creatorId` / `assigneeId`; the parser only
 * captures the IDs from the API payload.
 */
export interface Issue {
  /** Unique surrogate identifier assigned by the backend. */
  id: number;

  /** Parent task ID if the issue is scoped to a task; otherwise undefined. */
  taskId?: number;

  /** Denormalised parent-task name for list-view rendering. May be absent on partial DTOs. */
  taskName?: string;

  /** Short human-readable summary. */
  title: string;

  /** Optional long-form description. */
  description?: string;

  /** Domain category — see {@link IssueType}. */
  type: IssueType;

  /** Lifecycle state — see {@link IssueStatus}. */
  status: IssueStatus;

  /** Creation timestamp (UTC). */
  createdAt: Date;

  /** Last-update timestamp (UTC); undefined when the issue has not been modified. */
  updatedAt?: Date;

  /** ID of the employee who created the issue. */
  creatorId?: number;

  /** Resolved creator {@link Employee} — populated at the hook layer, never present on the raw API payload. */
  creator?: Employee;

  /** ID of the employee currently assigned (nullable to support explicit "unassigned"). */
  assigneeId?: number | null;

  /** Resolved assignee {@link Employee} — populated at the hook layer. */
  assignee?: Employee;

  /** Nested comments; absent on partial response DTOs. */
  comments?: IssueComment[];

  /** Nested attachments; absent on partial response DTOs. */
  attachments?: Attachment[];
}

/**
 * Parses a raw API payload into a typed {@link Issue}.
 *
 * The backend payload uses `createdById`, `assignedToId`, and
 * `issueComments` field names; this parser maps them onto the domain
 * fields `creatorId`, `assigneeId`, and `comments`. Joined entities
 * (`creator`, `assignee`) are intentionally left undefined here — they
 * are resolved by the query hooks from the cached employee list.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `Issue` domain object.
 * @throws {TypeError} If `id` is missing or not a positive integer.
 * @throws {Error} If `type` or `status` cannot be mapped to a known enum member.
 */
export function parseIssue(json: unknown): Issue {
  const raw = IssueResponseSchema.parse(json);
  const id = parsePositiveInt(raw.id, 'parseIssue.id');

  return {
    id,
    taskId: raw.taskId ?? undefined,
    taskName: raw.taskName ?? undefined,
    title: raw.title ?? '',
    description: raw.description ?? undefined,
    type: issueTypeFromString(raw.type),
    status: issueStatusFromString(raw.status),
    createdAt: parseUTCDate(raw.createdAt) ?? new Date(),
    updatedAt: raw.updatedAt
      ? (parseUTCDate(raw.updatedAt) ?? undefined)
      : undefined,
    creatorId: raw.createdById ?? undefined,
    assigneeId: raw.assignedToId ?? undefined,
    comments: raw.issueComments
      ? raw.issueComments.map((c) => parseIssueComment(c))
      : [],
    attachments: raw.attachments
      ? raw.attachments.map((a) => parseAttachment(a))
      : [],
  };
}

/**
 * Serializes an {@link Issue} for transmission to the backend.
 *
 * Maps `creatorId` → `createdById` and `assigneeId` → `assignedToId` to
 * match the wire shape. Nested arrays (`comments`, `attachments`) are
 * intentionally omitted — the backend manages those through dedicated
 * endpoints.
 *
 * @param issue - The domain object to serialize.
 * @returns A plain object matching the backend's expected request body shape.
 */
export function issueToJson(issue: Issue): Record<string, unknown> {
  return {
    id: issue.id,
    taskId: issue.taskId,
    title: issue.title,
    description: issue.description,
    type: issue.type,
    status: issue.status,
    createdAt: toLocalDateTimeString(issue.createdAt),
    updatedAt: issue.updatedAt && toLocalDateTimeString(issue.updatedAt),
    createdById: issue.creatorId ?? issue.creator?.id,
    assignedToId: issue.assigneeId ?? issue.assignee?.id,
  };
}

/**
 * Returns a new {@link Issue} with the supplied fields overlaid on the
 * original. Use for immutable updates in client code.
 *
 * @param issue - The base issue.
 * @param updates - Partial set of fields to overlay.
 * @returns A new `Issue` instance.
 */
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

/**
 * Structural equality for two {@link Issue} values. Compares scalar fields
 * and ID-bearing references only; nested arrays (`comments`, `attachments`)
 * are ignored.
 *
 * @param a - First issue.
 * @param b - Second issue.
 * @returns Whether the two issues are equal across the compared fields.
 */
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
