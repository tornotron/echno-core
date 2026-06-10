/**
 * @module use-material-consumption-mutations
 *
 * TanStack mutation hooks for the material-consumption domain. Consumption
 * is an append-only ledger — the backend exposes no update or delete
 * endpoint, so this module ships a single create hook.
 *
 * Read-side hooks live in {@link useAllMaterialConsumptions},
 * {@link useMaterialConsumptionsPaginated},
 * {@link useMaterialConsumption},
 * {@link useConsumptionsByMaterial}, {@link useConsumptionsByType},
 * {@link useConsumptionsByTask}, and {@link useConsumptionsByDateRange}.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { materialConsumptionService } from '../../services/material-consumption-service';
import { materialConsumptionsKeys } from './material-consumption-keys';
import type {
  CreateMaterialConsumptionRequest,
  MaterialConsumption,
} from '../../types/materials';
import { materialsKeys } from '../materials';
import { logger } from '../../lib/logger';

/**
 * Records a new consumption event.
 *
 * Backend response: `MaterialConsumptionDto` (full).
 *
 * On success:
 * - `setQueryData(materialConsumptionsKeys.detail(consumption.id), consumption)` —
 *   seeds the detail cache so an immediate navigation to the new event
 *   renders without a refetch.
 * - `invalidateQueries(materialConsumptionsKeys.all)` — kept as a single
 *   namespace-prefix invalidate: the create response is one event but the
 *   list (`lists`, `paginated`, `byMaterial`, `byType`, `byTask`,
 *   `byDateRange`) caches each apply a different server-side filter that
 *   can't be replayed locally against a single new entry. One broad
 *   invalidate is the correct shape for a single-create endpoint.
 * - `invalidateQueries(materialsKeys.stock(consumption.materialId))` —
 *   kept (cross-namespace): recording a consumption decreases
 *   `Material.currentStock` server-side, and the stock view is the
 *   canonical place that fact appears. The material list/detail caches
 *   also embed `currentStock` but tolerate the drift via `staleTime`,
 *   matching the existing pattern for stock-affecting operations.
 *
 * No invalidations are kept against the task namespace because the
 * {@link Task} entity does not embed consumption-derived state; the
 * task-scoped derived view ({@link useConsumptionsByTask}) lives inside
 * the consumption namespace and is covered by the prefix invalidate
 * above.
 *
 * Errors are logged via {@link logger}; the mutation result still
 * surfaces the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateMaterialConsumptionRequest}.
 */
export const useCreateConsumption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMaterialConsumptionRequest) =>
      materialConsumptionService.create(dto),
    onSuccess: (consumption) => {
      // POST /material-consumptions/web → MaterialConsumptionDto (full).
      queryClient.setQueryData<MaterialConsumption>(
        materialConsumptionsKeys.detail(consumption.id),
        consumption
      );
      // Own-namespace prefix invalidate: list, paginated, byMaterial, byType,
      // byTask, byDateRange. Each applies a server-side filter we can't
      // replay against a single response, so a broad invalidate is the
      // correct shape for a single-create endpoint.
      queryClient.invalidateQueries({
        queryKey: materialConsumptionsKeys.all,
      });
      // Cross-namespace (consumption → material): recording a consumption
      // decreases Material.currentStock server-side. Invalidate the canonical
      // stock query so any stock display refetches. Material list/detail
      // caches also embed currentStock but ride out the drift via staleTime,
      // matching the existing pattern for stock-affecting operations.
      queryClient.invalidateQueries({
        queryKey: materialsKeys.stock(consumption.materialId),
      });
    },
    onError: (error) =>
      logger.error('Failed to create material consumption:', error),
  });
};
