/**
 * @module use-holidays-mutations
 *
 * Mutation hooks for the holiday calendar. Each invalidates the domain prefix
 * on success, so every year view and the working week refetch together.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { holidaysService } from '../../services/holidays-service';
import {
  HolidayRequest,
  WorkingWeekRequest,
} from '../../types/holidays/holidays';
import { holidaysKeys } from './keys';

function useInvalidateHolidays() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: holidaysKeys.all });
}

/** Declares a holiday. Mutate with the {@link HolidayRequest}. */
export function useCreateHoliday() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (req: HolidayRequest) => holidaysService.create(req),
    onSuccess: invalidate,
  });
}

/** Replaces a holiday's date, name and note. Mutate with `{ holidayId, data }`. */
export function useUpdateHoliday() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: ({ holidayId, data }: { holidayId: number; data: HolidayRequest }) =>
      holidaysService.update(holidayId, data),
    onSuccess: invalidate,
  });
}

/** Removes a holiday. Mutate with the holiday id. */
export function useDeleteHoliday() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (holidayId: number) => holidaysService.remove(holidayId),
    onSuccess: invalidate,
  });
}

/** Sets the organization's working days. Mutate with the {@link WorkingWeekRequest}. */
export function useUpdateWorkingWeek() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (req: WorkingWeekRequest) => holidaysService.updateWorkingWeek(req),
    onSuccess: invalidate,
  });
}
