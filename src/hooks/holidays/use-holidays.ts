/**
 * @module use-holidays
 *
 * Query hooks for the holiday calendar and working week.
 */

import { useQuery } from '@tanstack/react-query';
import { holidaysService } from '../../services/holidays-service';
import { shouldRetry } from '../../lib/query/retry';
import { holidaysKeys } from './keys';

/** The holidays of one calendar year, in date order. */
export function useHolidaysForYear(year: number) {
  return useQuery({
    queryKey: holidaysKeys.year(year),
    queryFn: () => holidaysService.listForYear(year),
    retry: shouldRetry,
  });
}

/** One holiday; disabled until an id is known. */
export function useHoliday(holidayId: number | undefined) {
  return useQuery({
    queryKey: holidaysKeys.detail(holidayId ?? 0),
    queryFn: () => holidaysService.get(holidayId as number),
    enabled: Boolean(holidayId),
    retry: shouldRetry,
  });
}

/** The organization's working week. */
export function useWorkingWeek() {
  return useQuery({
    queryKey: holidaysKeys.workingWeek(),
    queryFn: () => holidaysService.getWorkingWeek(),
    retry: shouldRetry,
  });
}
