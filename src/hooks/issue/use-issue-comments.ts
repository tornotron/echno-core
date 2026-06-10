/**
 * @module use-issue-comments
 *
 * TanStack Query hooks for reading issue comments. Each hook resolves the
 * comment `author` from the cached employee list so consumers receive
 * `IssueComment` objects with populated joined fields.
 *
 * Mutations live in {@link useCreateIssueComment},
 * {@link useUpdateIssueComment} (orphan), and {@link useDeleteIssueComment}.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { issueCommentService } from '../../services/issue-comment-service';
import { useEmployees } from '../employee/use-employee';
import { useUserEmployees } from '../user/use-user';
import { IssueComment } from '../../types/issue/issue-comment';
import { Employee } from '../../types/employee';
import { shouldRetry } from '../../lib/query/retry';
import { issueCommentKeys } from './keys';

/**
 * Resolves the `author` on every comment by looking up `authorId` in the
 * supplied flat employee list.
 *
 * @param comments - Comments to enrich.
 * @param employees - Flat employee list (combination of org-wide and user-scoped caches).
 * @returns A new array of comments with `author` populated.
 */
function resolveCommentAuthors(
  comments: IssueComment[],
  employees: Employee[]
): IssueComment[] {
  return comments.map((comment) => ({
    ...comment,
    author: comment.authorId
      ? employees.find((e) => e.id === comment.authorId)
      : undefined,
  }));
}

/**
 * Fetches every issue comment with `author` resolved.
 *
 * `staleTime` 5 min, retries via {@link shouldRetry}, exponential
 * back-off capped at 30 s.
 *
 * @returns A TanStack `UseQueryResult` wrapping `IssueComment[]` with `author` populated.
 */
export function useIssueComments() {
  const commentsQuery = useQuery({
    queryKey: issueCommentKeys.lists(),
    queryFn: () => issueCommentService.getAll(),
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });

  const { data: allEmployees = [] } = useEmployees();
  const { data: userEmployees = [] } = useUserEmployees();

  const employees = useMemo(() => {
    const map = new Map<number, Employee>();
    for (const e of [...allEmployees, ...userEmployees]) {
      if (e.id !== undefined) map.set(e.id, e);
    }
    return [...map.values()];
  }, [allEmployees, userEmployees]);

  const data = useMemo(
    () =>
      commentsQuery.data
        ? resolveCommentAuthors(commentsQuery.data, employees)
        : commentsQuery.data,
    [commentsQuery.data, employees]
  );

  return { ...commentsQuery, data };
}

/**
 * Fetches every comment scoped to a single issue, with `author` resolved.
 *
 * `staleTime` 5 min, retries via {@link shouldRetry}, exponential
 * back-off capped at 30 s. The query is disabled until `issueId` is truthy.
 *
 * @param issueId - Surrogate ID of the parent issue. Pass `undefined` to
 *   defer until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping `IssueComment[]` with `author` populated.
 */
export function useIssueCommentsByIssue(issueId?: number) {
  const commentsQuery = useQuery({
    queryKey: issueCommentKeys.byIssue(issueId ?? 0),
    queryFn: () => {
      if (!issueId) {
        throw new Error('Issue ID is required');
      }
      return issueCommentService.getByIssueId(issueId);
    },
    enabled: !!issueId,
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });

  const { data: allEmployees = [] } = useEmployees();
  const { data: userEmployees = [] } = useUserEmployees();

  const employees = useMemo(() => {
    const map = new Map<number, Employee>();
    for (const e of [...allEmployees, ...userEmployees]) {
      if (e.id !== undefined) map.set(e.id, e);
    }
    return [...map.values()];
  }, [allEmployees, userEmployees]);

  const data = useMemo(
    () =>
      commentsQuery.data
        ? resolveCommentAuthors(commentsQuery.data, employees)
        : commentsQuery.data,
    [commentsQuery.data, employees]
  );

  return { ...commentsQuery, data };
}

/**
 * Fetches a single issue comment by ID, with `author` resolved.
 *
 * `staleTime` 5 min, retries via {@link shouldRetry}, exponential
 * back-off capped at 30 s. The query is disabled until `id` is truthy.
 *
 * @param id - Surrogate ID of the issue comment. Pass `undefined` to defer
 *   until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single `IssueComment` with `author` populated.
 */
export function useIssueComment(id?: number) {
  const commentQuery = useQuery({
    queryKey: issueCommentKeys.detail(id ?? 0),
    queryFn: () => {
      if (!id) {
        throw new Error('Issue comment ID is required');
      }
      return issueCommentService.getById(id);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });

  const { data: allEmployees = [] } = useEmployees();
  const { data: userEmployees = [] } = useUserEmployees();

  const employees = useMemo(() => {
    const map = new Map<number, Employee>();
    for (const e of [...allEmployees, ...userEmployees]) {
      if (e.id !== undefined) map.set(e.id, e);
    }
    return [...map.values()];
  }, [allEmployees, userEmployees]);

  const data = useMemo(() => {
    if (!commentQuery.data) return commentQuery.data;
    return resolveCommentAuthors([commentQuery.data], employees)[0];
  }, [commentQuery.data, employees]);

  return { ...commentQuery, data };
}
