import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { issueService } from '../../services/issue-service';
import { useEmployees } from '../employee/use-employee';
import { useUserEmployees } from '../user/use-user';
import { Issue } from '../../types/issue/issue';
import { Employee } from '../../types/employee';
import { shouldRetry } from '../../lib/query/retry';
import { issueKeys } from './issue-keys';

/** Resolve creator, assignee, and comment authors on each issue from a flat employee list. */
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
 * Hook to fetch all issues with creator/assignee resolved to full Employee objects.
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
 * Hook to fetch a single issue by ID with creator/assignee resolved.
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
 * Hook to fetch issues by project ID with creator/assignee resolved.
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
 * Hook to fetch issues by task ID with creator/assignee resolved.
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
