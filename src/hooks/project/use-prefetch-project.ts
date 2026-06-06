/**
 * hooks/project/use-prefetch-project.ts
 *
 * Hover/focus prefetch for the project detail query. Wire on `onMouseEnter`
 * and `onFocus` of list-row links so the detail page renders against a warm
 * cache when the user actually navigates.
 *
 * `staleTime` matches the consuming `useProject` query (5 min). If a prefetch
 * lands within that window of a previous fetch, React Query returns
 * immediately without a network call — rapid hover sweeps over a list cost
 * one fetch per project, not one per hover event.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project-service';
import { projectKeys } from './project-keys';

const PROJECT_DETAIL_STALE_TIME = 5 * 60 * 1000;

export function usePrefetchProject() {
  const queryClient = useQueryClient();
  return useCallback(
    (id: number) => {
      if (!id) return;
      queryClient.prefetchQuery({
        queryKey: projectKeys.detail(id),
        queryFn: () => projectService.getById(id),
        staleTime: PROJECT_DETAIL_STALE_TIME,
      });
    },
    [queryClient]
  );
}
