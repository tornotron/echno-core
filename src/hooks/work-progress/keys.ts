/**
 * TanStack Query key factory for the Work Progress module.
 *
 * Key shapes:
 * - `['work-progress']`: namespace root; the invalidation prefix.
 * - `['work-progress', 'list', params]`: one page of progress inspections.
 * - `['work-progress', 'detail', id]`: one record.
 * - `['work-progress', 'detail', id, 'evidence']`: its evidence.
 */
import type { ProgressInspectionListParams } from '../../types/work-progress/work-progress';

export const workProgressKeys = {
  all: ['work-progress'] as const,
  lists: () => [...workProgressKeys.all, 'list'] as const,
  list: (params: ProgressInspectionListParams = {}) =>
    [...workProgressKeys.lists(), params] as const,
  details: () => [...workProgressKeys.all, 'detail'] as const,
  detail: (id: string) => [...workProgressKeys.details(), id] as const,
  evidence: (id: string) => [...workProgressKeys.detail(id), 'evidence'] as const,
};
