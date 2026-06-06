// types/issue/issue-comment.ts

import { Employee } from '../employee/employee';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { parsePositiveInt } from '../../lib/utils/parse-id';

/**
 * IssueComment – shape only
 */
export interface IssueComment {
  id: number;
  comment: string;
  authorId?: number;
  author?: Employee; // resolved at hook level from authorId
  createdAt: Date;
}

/** -------------------------------------------------------------
 *  JSON → IssueComment
 *  API shape: { id, comment, authorId, createdAt }
 *  author is NOT embedded — resolved by hooks.
 *  ------------------------------------------------------------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseIssueComment(json: any): IssueComment {
  const id = parsePositiveInt(json.id, 'parseIssueComment.id');

  return {
    id,
    comment: json.comment ?? '',
    authorId: json.authorId ?? undefined,
    createdAt: parseUTCDate(json.createdAt) ?? new Date(),
  };
}

/** -------------------------------------------------------------
 *  IssueComment → JSON
 *  ------------------------------------------------------------- */
export function issueCommentToJson(
  comment: IssueComment
): Record<string, unknown> {
  return {
    id: comment.id,
    comment: comment.comment,
    authorId: comment.authorId ?? comment.author?.id,
    createdAt: comment.createdAt.toISOString(),
  };
}

/** -------------------------------------------------------------
 *  Equality check (like Equatable.props)
 *  Useful for React memo, useMemo, etc.
 *  ------------------------------------------------------------- */
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
