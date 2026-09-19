/**
 * @module use-toolbox-talks
 *
 * Query hooks for the Toolbox Talks domain.
 */

import { useQuery } from '@tanstack/react-query';
import { toolboxTalksService } from '../../services/toolbox-talks-service';
import { shouldRetry } from '../../lib/query/retry';
import type { ToolboxTalkListParams } from '../../types/toolbox-talks/toolbox-talks';
import { toolboxTalksKeys } from './keys';

/** One page of talks, keyed on the list params. */
export function useToolboxTalks(params: ToolboxTalkListParams = {}) {
  return useQuery({
    queryKey: toolboxTalksKeys.list(params),
    queryFn: () => toolboxTalksService.list(params),
    retry: shouldRetry,
  });
}

/** One talk; disabled until an id is known. */
export function useToolboxTalk(id: string | undefined) {
  return useQuery({
    queryKey: toolboxTalksKeys.detail(id ?? ''),
    queryFn: () => toolboxTalksService.get(id as string),
    enabled: Boolean(id),
    retry: shouldRetry,
  });
}

/** A talk's registered photo evidence; disabled until an id is known. */
export function useToolboxTalkPhotos(id: string | undefined) {
  return useQuery({
    queryKey: toolboxTalksKeys.photos(id ?? ''),
    queryFn: () => toolboxTalksService.getPhotos(id as string),
    enabled: Boolean(id),
    retry: shouldRetry,
  });
}
