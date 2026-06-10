/**
 * @module use-prefetch-issue
 *
 * Hover/focus prefetch for the issue detail query. Wire on
 * `onMouseEnter` / `onFocus` of issue-row click handlers so the detail
 * page renders against a warm cache when the user navigates.
 *
 * `staleTime` matches {@link useIssue} (5 min) — prefetches deduplicate
 * within that window, so a rapid hover sweep over an issue table costs
 * one fetch per issue, not one per hover event.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { issueService } from '../../services/issue-service';
import { issueKeys } from './keys';

const ISSUE_DETAIL_STALE_TIME = 5 * 60 * 1000;

/**
 * Returns a stable callback that prefetches the detail query for a given
 * issue ID. The callback is a no-op for falsy IDs.
 *
 * @returns A function `(id: number) => void` suitable for `onMouseEnter` /
 *   `onFocus` handlers.
 */
export function usePrefetchIssue() {
  const queryClient = useQueryClient();
  return useCallback(
    (id: number) => {
      if (!id) return;
      queryClient.prefetchQuery({
        queryKey: issueKeys.detail(id),
        queryFn: () => issueService.getById(id),
        staleTime: ISSUE_DETAIL_STALE_TIME,
      });
    },
    [queryClient]
  );
}
