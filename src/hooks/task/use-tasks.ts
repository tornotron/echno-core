import { useQuery } from '@tanstack/react-query';
import { taskService } from '../../services/task-service';
import { shouldRetry } from '../../lib/query/retry';
import { taskKeys } from './task-keys';

/**
 * Hook to fetch all tasks.
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
 * Hook to fetch a single task by ID.
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
 * Hook to fetch tasks by project ID.
 * Fetches all tasks and filters client-side (no dedicated backend endpoint).
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
