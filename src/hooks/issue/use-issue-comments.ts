import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { issueCommentService } from '../../services/issue-comment-service';
import { useEmployees } from '../employee/use-employee';
import { useUserEmployees } from '../user/use-user';
import { IssueComment } from '../../types/issue/issue-comment';
import { Employee } from '../../types/employee';
import { shouldRetry } from '../../lib/query/retry';
import { issueCommentKeys } from './issue-keys';

/** Resolve author on each comment from a flat employee list. */
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
 * Hook to fetch all issue comments with author resolved.
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
 * Hook to fetch all comments for a specific issue with author resolved.
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
 * Hook to fetch a single issue comment by ID with author resolved.
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
