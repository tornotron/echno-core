/**
 * @module use-tasks
 *
 * Read-side TanStack Query hooks for the task domain. Each hook wraps a
 * {@link taskService} call with a 5-minute `staleTime`, the shared
 * {@link shouldRetry} predicate, and an exponential retry-delay cap at
 * 30 s. Hooks that depend on an ID stay disabled until the ID is truthy.
 */
import { useQuery } from '@tanstack/react-query';
import { taskService } from '../../services/task-service';
import { shouldRetry } from '../../lib/query/retry';
import { taskKeys } from './keys';

/**
 * Fetches every task visible to the current user.
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
 * Fetches every task belonging to one project.
 *
 * No dedicated backend endpoint exists, so the hook fetches the full
 * task list via {@link taskService.getAll} and filters client-side by
 * `projectId`. The result is cached under `taskKeys.byProject(projectId)`
 * so mutation hooks can patch the per-project cache directly without
 * reissuing the global fetch.
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
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      const allTasks = await taskService.getAll();
      return allTasks.filter((task) => task.projectId === projectId);
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}
