/**
 * @module use-material-consumption
 *
 * TanStack Query hooks for reading material-consumption events. Mutations
 * live in {@link useCreateConsumption}.
 *
 * None of the query hooks below spread a profile from `lib/query/options`;
 * they inherit the host `QueryClient`'s defaults (mirroring the
 * **standard** profile of `staleTime` 60 s / `gcTime` 5 min when the host
 * uses the recommended setup).
 */
import { useQuery } from '@tanstack/react-query';
import { materialConsumptionService } from '../../services/material-consumption-service';
import { ConsumptionType } from '../../types/materials';
import { materialConsumptionsKeys } from './material-consumption-keys';

/**
 * Fetches every consumption event (unpaginated).
 *
 * @returns A TanStack `UseQueryResult` wrapping `MaterialConsumption[]`.
 */
export const useAllMaterialConsumptions = () =>
  useQuery({
    queryKey: materialConsumptionsKeys.lists(),
    queryFn: () => materialConsumptionService.getAll(),
  });

/**
 * Fetches a page of consumption events.
 *
 * @param pageNo - Zero-based page number. Defaults to `0`.
 * @param pageSize - Number of events per page. Defaults to `10`.
 * @returns A TanStack `UseQueryResult` wrapping `MaterialConsumption[]`
 *   for the page.
 */
export const useMaterialConsumptionsPaginated = (pageNo = 0, pageSize = 10) =>
  useQuery({
    queryKey: materialConsumptionsKeys.paginated(pageNo, pageSize),
    queryFn: () =>
      materialConsumptionService.getAllPaginated(pageNo, pageSize),
  });

/**
 * Fetches a single consumption event by ID. The query is disabled until
 * `id` is truthy.
 *
 * @param id - Surrogate ID of the consumption event. Pass `0` (or any
 *   falsy value) to defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single
 *   `MaterialConsumption`.
 */
export const useMaterialConsumption = (id: number) =>
  useQuery({
    queryKey: materialConsumptionsKeys.detail(id),
    queryFn: () => materialConsumptionService.getById(id),
    enabled: !!id,
  });

/**
 * Fetches every consumption event recorded against a given material. The
 * query is disabled until `materialId` is truthy.
 *
 * @param materialId - Surrogate ID of the {@link Material}.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `MaterialConsumption[]`.
 */
export const useConsumptionsByMaterial = (materialId: number) =>
  useQuery({
    queryKey: materialConsumptionsKeys.byMaterial(materialId),
    queryFn: () => materialConsumptionService.getByMaterial(materialId),
    enabled: !!materialId,
  });

/**
 * Fetches every consumption event of the given mechanism. The query is
 * disabled until `type` is truthy.
 *
 * @param type - The {@link ConsumptionType} to filter by.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `MaterialConsumption[]`.
 */
export const useConsumptionsByType = (type: ConsumptionType) =>
  useQuery({
    queryKey: materialConsumptionsKeys.byType(type),
    queryFn: () => materialConsumptionService.getByType(type),
    enabled: !!type,
  });

/**
 * Fetches every consumption event allocated to the given task. The query
 * is disabled until `taskId` is a positive integer.
 *
 * @param taskId - Surrogate ID of the task.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `MaterialConsumption[]`.
 */
export const useConsumptionsByTask = (taskId: number) =>
  useQuery({
    queryKey: materialConsumptionsKeys.byTask(taskId),
    queryFn: () => materialConsumptionService.getByTask(taskId),
    enabled: taskId > 0,
  });

/**
 * Fetches every consumption event whose `consumptionDate` falls inside
 * the given inclusive date range. The query is disabled until both
 * `startDate` and `endDate` are non-empty strings.
 *
 * @param startDate - ISO 8601 start date (inclusive).
 * @param endDate - ISO 8601 end date (inclusive).
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `MaterialConsumption[]`.
 */
export const useConsumptionsByDateRange = (
  startDate: string,
  endDate: string
) =>
  useQuery({
    queryKey: materialConsumptionsKeys.byDateRange(startDate, endDate),
    queryFn: () =>
      materialConsumptionService.getByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
