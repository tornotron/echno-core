/**
 * TanStack Query key factory for the holiday calendar.
 *
 * Key shapes:
 * - `['holidays']`: namespace root; the invalidation prefix.
 * - `['holidays', 'year', year]`: the holidays of one calendar year.
 * - `['holidays', 'detail', id]`: one holiday.
 * - `['holidays', 'working-week']`: the organization's working week.
 *
 * Every mutation invalidates `holidaysKeys.all`, so a change to a holiday or
 * to the working week refreshes every year view in one sweep.
 */
export const holidaysKeys = {
  all: ['holidays'] as const,
  years: () => [...holidaysKeys.all, 'year'] as const,
  year: (year: number) => [...holidaysKeys.years(), year] as const,
  details: () => [...holidaysKeys.all, 'detail'] as const,
  detail: (id: number) => [...holidaysKeys.details(), id] as const,
  workingWeek: () => [...holidaysKeys.all, 'working-week'] as const,
};
