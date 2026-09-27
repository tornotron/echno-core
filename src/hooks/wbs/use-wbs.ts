/**
 * @module use-wbs
 *
 * Query hooks for a project's schedule.
 */

import { useQuery } from '@tanstack/react-query';
import { wbsService } from '../../services/wbs-service';
import { shouldRetry } from '../../lib/query/retry';
import { wbsKeys } from './keys';

/** The project's activities and links; disabled until a project id is known. */
export function useWbsSchedule(projectId: number | undefined) {
  return useQuery({
    queryKey: wbsKeys.schedule(projectId ?? 0),
    queryFn: () => wbsService.getSchedule(projectId as number),
    enabled: projectId !== undefined && projectId > 0,
    retry: shouldRetry,
  });
}
