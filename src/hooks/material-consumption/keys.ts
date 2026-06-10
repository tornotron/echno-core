/**
 * @module material-consumption-keys
 *
 * TanStack Query key factory for the material-consumption domain.
 *
 * Key shapes:
 * - `['material-consumptions']` — namespace root, invalidation prefix
 *   only; never used as a query key directly. The single create mutation
 *   invalidates the whole namespace via this key.
 * - `['material-consumptions', 'list']` — the unpaginated event list,
 *   consumed by {@link useAllMaterialConsumptions}.
 * - `['material-consumptions', 'detail', id]` — a single event by ID,
 *   consumed by {@link useMaterialConsumption}.
 * - `['material-consumptions', 'paginated', { pageNo, pageSize }]` —
 *   paginated list, consumed by {@link useMaterialConsumptionsPaginated}.
 * - `['material-consumptions', 'material', materialId]` — events filtered
 *   by material, consumed by {@link useConsumptionsByMaterial}.
 * - `['material-consumptions', 'type', type]` — events filtered by
 *   {@link ConsumptionType}, consumed by {@link useConsumptionsByType}.
 * - `['material-consumptions', 'task', taskId]` — events filtered by
 *   task, consumed by {@link useConsumptionsByTask}.
 * - `['material-consumptions', 'date-range', startDate, endDate]` —
 *   events within a date range, consumed by
 *   {@link useConsumptionsByDateRange}.
 *
 * Every list key applies a server-side filter the create mutation cannot
 * replay locally, so {@link useCreateConsumption} invalidates the whole
 * namespace via `all` rather than trying to patch each list cache
 * individually.
 */
import { ConsumptionType } from '../../types/materials';

export const materialConsumptionsKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['material-consumptions'] as const,

  /** Query key for the unpaginated consumption-event list. */
  lists: () => [...materialConsumptionsKeys.all, 'list'] as const,

  /** Query key for a single consumption event by ID. */
  detail: (id: number) =>
    [...materialConsumptionsKeys.all, 'detail', id] as const,

  /** Query key for a paginated consumption-event list. */
  paginated: (pageNo: number, pageSize: number) =>
    [
      ...materialConsumptionsKeys.all,
      'paginated',
      { pageNo, pageSize },
    ] as const,

  /** Query key for events filtered by material. */
  byMaterial: (materialId: number) =>
    [...materialConsumptionsKeys.all, 'material', materialId] as const,

  /** Query key for events filtered by {@link ConsumptionType}. */
  byType: (type: ConsumptionType) =>
    [...materialConsumptionsKeys.all, 'type', type] as const,

  /** Query key for events filtered by task. */
  byTask: (taskId: number) =>
    [...materialConsumptionsKeys.all, 'task', taskId] as const,

  /** Query key for events within an inclusive date range. */
  byDateRange: (startDate: string, endDate: string) =>
    [
      ...materialConsumptionsKeys.all,
      'date-range',
      startDate,
      endDate,
    ] as const,
};
