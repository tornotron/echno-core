/**
 * @module use-toolbox-talks
 *
 * Query hooks for the Toolbox Talks domain.
 */

import { useQuery } from '@tanstack/react-query';
import { toolboxTalksService } from '../../services/toolbox-talks-service';
import { shouldRetry } from '../../lib/query/retry';
import type { ToolboxTalksListParams } from '../../types/toolbox-talks/toolbox-talks';
import { toolboxTalksKeys } from './keys';

/** One page of records, keyed on the list params. */
export function useToolboxTalksList(params: ToolboxTalksListParams = {}) {
  return useQuery({
    queryKey: toolboxTalksKeys.list(params),
    queryFn: () => toolboxTalksService.list(params),
    retry: shouldRetry,
  });
}

/** One record; disabled until an id is known. */
export function useToolboxTalks(id: string | undefined) {
  return useQuery({
    queryKey: toolboxTalksKeys.detail(id ?? ''),
    queryFn: () => toolboxTalksService.get(id as string),
    enabled: Boolean(id),
    retry: shouldRetry,
  });
}
