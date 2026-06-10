/**
 * @module use-issues
 *
 * TanStack Query hooks for reading issues. Each hook resolves nested
 * employee references (`creator`, `assignee`, and comment `author`) from
 * the cached employee list so consumers receive `Issue` objects with
 * fully populated joined fields.
 *
 * Mutations live in {@link useCreateIssue}, {@link useUpdateIssue}, and
 * {@link useDeleteIssue}.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { issueService } from '../../services/issue-service';
import { useEmployees } from '../employee/use-employee';
import { useUserEmployees } from '../user/use-user';
import { Issue } from '../../types/issue/issue';
import { Employee } from '../../types/employee';
import { shouldRetry } from '../../lib/query/retry';
import { issueKeys } from './keys';

/**
 * Resolves `creator`, `assignee`, and each comment's `author` on every
 * issue by looking up IDs in the supplied flat employee list.
 *
 * @param issues - Issues to enrich.
 * @param employees - Flat employee list (combination of org-wide and user-scoped caches).
 * @returns A new array of issues with joined `creator`, `assignee`, and `comments[].author` populated.
 */
function resolveEmployees(issues: Issue[], employees: Employee[]): Issue[] {
  return issues.map((issue) => ({
    ...issue,
    creator: issue.creatorId
      ? employees.find((e) => e.id === issue.creatorId)
      : undefined,
    assignee: issue.assigneeId
      ? employees.find((e) => e.id === issue.assigneeId)
      : undefined,
    comments: issue.comments?.map((comment) => ({
      ...comment,
      author: comment.authorId
        ? employees.find((e) => e.id === comment.authorId)
        : undefined,
    })),
  }));
}

/**
 * Fetches every issue visible to the current user, with `creator`,
 * `assignee`, and comment authors resolved.
 *
 * `staleTime` 5 min, retries via {@link shouldRetry}, exponential
 * back-off capped at 30 s.
 *
 * @returns A TanStack `UseQueryResult` wrapping `Issue[]` with joined fields populated.
 */
export function useIssues() {
  const issuesQuery = useQuery({
    queryKey: issueKeys.lists(),
    queryFn: () => issueService.getAll(),
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
      issuesQuery.data
        ? resolveEmployees(issuesQuery.data, employees)
        : issuesQuery.data,
    [issuesQuery.data, employees]
  );

  return { ...issuesQuery, data };
}

/**
 * Fetches a single issue by ID with joined fields resolved.
 *
 * `staleTime` 5 min, retries via {@link shouldRetry}, exponential
 * back-off capped at 30 s. The query is disabled until `id` is truthy.
 *
 * @param id - Surrogate ID of the issue. Pass `undefined` to defer the
 *   query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single `Issue` with joined fields populated.
 */
export function useIssue(id?: number) {
  const issueQuery = useQuery({
    queryKey: issueKeys.detail(id ?? 0),
    queryFn: () => {
      if (!id) {
        throw new Error('Issue ID is required');
      }
      return issueService.getById(id);
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
    if (!issueQuery.data) return issueQuery.data;
    return resolveEmployees([issueQuery.data], employees)[0];
  }, [issueQuery.data, employees]);

  return { ...issueQuery, data };
}

/**
 * Fetches issues scoped to a single project, with joined fields resolved.
 *
 * `staleTime` 5 min, retries via {@link shouldRetry}, exponential
 * back-off capped at 30 s. The query is disabled until `projectId` is truthy.
 *
 * @param projectId - Surrogate ID of the project. Pass `undefined` to
 *   defer until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping `Issue[]` with joined fields populated.
 */
export function useIssuesByProject(projectId?: number) {
  const issuesQuery = useQuery({
    queryKey: issueKeys.byProject(projectId ?? 0),
    queryFn: () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return issueService.getByProjectId(projectId);
    },
    enabled: !!projectId,
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
      issuesQuery.data
        ? resolveEmployees(issuesQuery.data, employees)
        : issuesQuery.data,
    [issuesQuery.data, employees]
  );

  return { ...issuesQuery, data };
}

/**
 * Fetches issues scoped to a single task, with joined fields resolved.
 *
 * `staleTime` 5 min, retries via {@link shouldRetry}, exponential
 * back-off capped at 30 s. The query is disabled until `taskId` is truthy.
 *
 * @param taskId - Surrogate ID of the parent task. Pass `undefined` to
 *   defer until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping `Issue[]` with joined fields populated.
 */
export function useIssuesByTask(taskId?: number) {
  const issuesQuery = useQuery({
    queryKey: issueKeys.byTask(taskId ?? 0),
    queryFn: () => {
      if (!taskId) {
        throw new Error('Task ID is required');
      }
      return issueService.getByTaskId(taskId);
    },
    enabled: !!taskId,
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
      issuesQuery.data
        ? resolveEmployees(issuesQuery.data, employees)
        : issuesQuery.data,
    [issuesQuery.data, employees]
  );

  return { ...issuesQuery, data };
}
