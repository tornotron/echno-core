/**
 * TanStack Query key factory for a project's schedule.
 *
 * Key shapes:
 * - `['wbs']`: namespace root; the invalidation prefix.
 * - `['wbs', 'schedule', projectId]`: one project's activities and links.
 *
 * Every schedule mutation invalidates `wbsKeys.all`. Recording a progress
 * inspection changes the activity too, so the work-progress mutations
 * invalidate this prefix as well.
 */
export const wbsKeys = {
  all: ['wbs'] as const,
  schedules: () => [...wbsKeys.all, 'schedule'] as const,
  schedule: (projectId: number) => [...wbsKeys.schedules(), projectId] as const,
};
