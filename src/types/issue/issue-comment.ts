/**
 * @module types/issue/issue-comment
 *
 * Domain type and JSON converters for an issue comment — a single
 * timestamped message authored by an employee on a parent {@link Issue}.
 */
import { z } from 'zod';
import { Employee } from '../employee/employee';
import {
  parseUTCDate,
  toLocalDateTimeString,
} from '../../lib/utils/date-helpers';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

/** Shape of the backend issue-comment payload at the parse boundary. */
const IssueCommentResponseSchema = z.object({
  id: opaque,
  comment: nullableString,
  authorId: optionalNumericId,
  createdAt: backendDate,
});

/**
 * Represents a single comment on an issue.
 *
 * Shallow scalars only — no nested arrays. `author` is populated at the
 * hook layer from the flat {@link Employee} cache via `authorId`.
 */
export interface IssueComment {
  /** Unique surrogate identifier assigned by the backend. */
  id: number;

  /** The comment body. */
  comment: string;

  /** ID of the employee who authored the comment. */
  authorId?: number;

  /** Resolved author {@link Employee} — populated at the hook layer, never present on the raw API payload. */
  author?: Employee;

  /** Creation timestamp (UTC). */
  createdAt: Date;
}

/**
 * Parses a raw API payload into a typed {@link IssueComment}.
 *
 * Joined `author` is intentionally left undefined — query hooks resolve
 * it from the cached employee list.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `IssueComment` domain object.
 * @throws {TypeError} If `id` is missing or not a positive integer.
 */
export function parseIssueComment(json: unknown): IssueComment {
  const raw = IssueCommentResponseSchema.parse(json);
  const id = parsePositiveInt(raw.id, 'parseIssueComment.id');

  return {
    id,
    comment: raw.comment ?? '',
    authorId: raw.authorId ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? new Date(),
  };
}

/**
 * Serializes an {@link IssueComment} for transmission to the backend.
 *
 * @param comment - The domain object to serialize.
 * @returns A plain object matching the backend's expected request body shape.
 */
export function issueCommentToJson(
  comment: IssueComment
): Record<string, unknown> {
  return {
    id: comment.id,
    comment: comment.comment,
    authorId: comment.authorId ?? comment.author?.id,
    createdAt: toLocalDateTimeString(comment.createdAt),
  };
}

/**
 * Structural equality for two {@link IssueComment} values.
 *
 * @param a - First comment.
 * @param b - Second comment.
 * @returns Whether the two comments are equal across all scalar fields.
 */
export function areIssueCommentsEqual(
  a: IssueComment,
  b: IssueComment
): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.comment === b.comment &&
    a.authorId === b.authorId &&
    a.createdAt.getTime() === b.createdAt.getTime()
  );
}
