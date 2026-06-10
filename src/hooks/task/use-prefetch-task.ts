/**
 * @module use-prefetch-task
 *
 * Hover/focus prefetch for the task detail query. Wire on `onMouseEnter`
 * / `onFocus` of task-row click handlers so the detail page renders
 * against a warm cache when the user navigates.
 *
 * `staleTime` matches `useTask` (5 min) — prefetches deduplicate within
 * that window, so a rapid hover sweep over a task table costs one fetch
 * per task, not one per hover event.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { taskService } from '../../services/task-service';
import { taskKeys } from './keys';

const TASK_DETAIL_STALE_TIME = 5 * 60 * 1000;

/**
 * Returns a stable prefetch callback for the task detail query.
 *
 * The returned function is a no-op when `id` is falsy. Wire it to
 * `onMouseEnter` / `onFocus` on list rows that link to the detail page.
 *
 * @returns A callback `(id: number) => void` that warms the
 *   `taskKeys.detail(id)` cache via {@link taskService.getById}.
 */
export function usePrefetchTask() {
  const queryClient = useQueryClient();
  return useCallback(
    (id: number) => {
      if (!id) return;
      queryClient.prefetchQuery({
        queryKey: taskKeys.detail(id),
        queryFn: () => taskService.getById(id),
        staleTime: TASK_DETAIL_STALE_TIME,
      });
    },
    [queryClient]
  );
}
