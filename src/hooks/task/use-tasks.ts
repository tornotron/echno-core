/**
 * @module use-tasks
 *
 * Read-side TanStack Query hooks for the task domain. Each hook wraps a
 * {@link taskService} call with a 5-minute `staleTime`, the shared
 * {@link shouldRetry} predicate, and an exponential retry-delay cap at
 * 30 s. Hooks that depend on an ID stay disabled until the ID is truthy.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  taskService,
  type PagedTask,
  type TaskPageParams,
} from '../../services/task-service';
import { shouldRetry } from '../../lib/query/retry';
import { taskKeys } from './keys';

/**
 * Fetches the current tenant's tasks, bounded by the backend's result cap.
 *
 * Prefer {@link useTasksPage} for a list a user pages through, and
 * {@link useTasksByProject} where only one project's tasks are wanted.
 *
 * `staleTime` is 5 minutes; retries follow {@link shouldRetry} with
 * exponential backoff capped at 30 s.
 *
 * @returns A TanStack `UseQueryResult` wrapping `Task[]`.
 */
export function useTasks() {
  return useQuery({
    queryKey: taskKeys.lists(),
    queryFn: () => taskService.getAll(),
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

/**
 * Fetches a single task by ID.
 *
 * Disabled until `id` is truthy; `staleTime` is 5 minutes; retries
 * follow {@link shouldRetry} with exponential backoff capped at 30 s.
 *
 * @param id - Surrogate ID of the task. Pass `undefined` to defer the
 *   query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping `Task`.
 */
export function useTask(id?: number) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? 0),
    queryFn: () => {
      if (!id) {
        throw new Error('Task ID is required');
      }
      return taskService.getById(id);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

/**
 * Fetches one page of tasks, newest first.
 *
 * Unlike {@link useTasks} this keeps the page metadata, so a list can show
 * how many tasks there are and move through them rather than silently
 * showing a prefix. `keepPreviousData` holds the current rows while the
 * next page loads.
 *
 * @param params - 0-based `page`, `size`, and optional `projectId` /
 *   `search` filters (both resolved server-side).
 * @returns A TanStack `UseQueryResult` wrapping {@link PagedTask}.
 */
export function useTasksPage(params: TaskPageParams = {}) {
  return useQuery<PagedTask>({
    queryKey: taskKeys.page(params),
    queryFn: () => taskService.getPage(params),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

/**
 * Fetches every task belonging to one project.
 *
 * Asks the backend for the project's tasks rather than filtering a list of
 * every task in the tenant. The old shape fetched `taskService.getAll()` and
 * kept the rows whose `projectId` matched, which was wrong twice over: the
 * bare list was capped, so a project whose tasks fell outside that prefix
 * rendered as having none at all, and every project view paid for the whole
 * tenant's tasks to use a handful of them.
 *
 * The cache key is unchanged (`taskKeys.byProject(projectId)`), so the
 * mutation hooks that patch the per-project cache keep working as they are.
 *
 * Disabled until `projectId` is truthy; `staleTime` is 5 minutes;
 * retries follow {@link shouldRetry} with exponential backoff capped at
 * 30 s.
 *
 * @param projectId - Surrogate ID of the project. Pass `undefined` to
 *   defer the query.
 * @returns A TanStack `UseQueryResult` wrapping `Task[]`.
 */
export function useTasksByProject(projectId?: number) {
  return useQuery({
    queryKey: taskKeys.byProject(projectId ?? 0),
    queryFn: () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return taskService.getByProjectId(projectId);
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}
