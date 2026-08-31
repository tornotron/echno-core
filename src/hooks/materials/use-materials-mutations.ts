/**
 * @module use-materials-mutations
 *
 * TanStack mutation hooks for the materials domain — create, update, and
 * delete, plus per-location threshold upsert and delete. Read-side hooks
 * live in {@link useMaterials}, {@link useMaterialsPaginated},
 * {@link useMaterialSearch}, {@link useMaterial},
 * {@link useMaterialWithStock}, and {@link useMaterialLocationThresholds}.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { materialsService } from '../../services/materials-service';
import { materialsKeys } from './keys';
import {
  CreateMaterialRequest,
  UpdateMaterialRequest,
  Material,
  MaterialLocationThreshold,
  MaterialLocationThresholdUpsert,
} from '../../types/materials';
import { logger } from '../../lib/logger';
import { isLowStockCache, isMaterialListCache } from './cache-predicates';

/**
 * Creates a new material.
 *
 * Backend response: `MaterialDto` (full).
 *
 * On success:
 * - `setQueryData(materialsKeys.detail(newMaterial.id), newMaterial)` —
 *   seeds the detail cache so an immediate read returns the new material
 *   without a network round-trip.
 * - `setQueryData(materialsKeys.lists(), append)` — appends the new
 *   material to the unpaginated list.
 * - `invalidateQueries({ predicate: search OR paginated })` — kept:
 *   search results are name-scoped (the new material may not match the
 *   active query) and paginated views depend on sort/page boundaries
 *   that can't be recomputed locally.
 *
 * Errors are logged via {@link logger}; the mutation result still surfaces
 * the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateMaterialRequest}.
 */
export const useCreateMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMaterialRequest) => materialsService.create(dto),
    onSuccess: (newMaterial) => {
      // POST /materials/web → MaterialDto (full).
      // Seed detail + append to the main list. Search/paginated caches are
      // invalidated rather than appended: search is name-scoped and may or
      // may not match; paginated semantics depend on sort/page and aren't
      // safe to mutate without knowing them.
      queryClient.setQueryData(
        materialsKeys.detail(newMaterial.id),
        newMaterial
      );
      queryClient.setQueryData<Material[]>(materialsKeys.lists(), (old) =>
        old ? [...old, newMaterial] : [newMaterial]
      );
      // Invalidate scoped lists where direct append isn't safe.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'materials' &&
          (q.queryKey[1] === 'search' || q.queryKey[1] === 'paginated'),
      });
      // A new material with a reorder level and no stock is low from the
      // moment it exists, and only the server knows that.
      queryClient.invalidateQueries({ predicate: isLowStockCache });
    },
    onError: (error) => {
      logger.error('Failed to create material:', error);
    },
  });
};

/**
 * Updates a material.
 *
 * Backend response: `MaterialDto` (full).
 *
 * On success:
 * - `setQueryData(materialsKeys.detail(id), updatedMaterial)` — direct
 *   patch of the detail cache from the full DTO.
 * - `setQueriesData({ predicate: isMaterialListCache }, replace)` —
 *   mirrors the update across every `Material[]` list cache (`list`,
 *   `search`, `paginated`).
 * - `invalidateQueries(materialsKeys.stock(id))` — kept: the stock view is
 *   `MaterialWithStock`, not `MaterialDto`, and edited material fields (e.g.
 *   `materialName`, `unit`, `reorderLevel`) may affect its display.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; data: UpdateMaterialRequest }`.
 */
export const useUpdateMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMaterialRequest }) =>
      materialsService.update(id, data),
    onSuccess: (updatedMaterial, { id }) => {
      // PATCH /materials/web/{id} → MaterialDto (full).
      // Patch detail + every Material[] list cache (list, search, paginated)
      // in one pass. Invalidate stock view — material fields may affect its
      // display and the response is MaterialDto, not MaterialWithStockDto.
      queryClient.setQueryData(materialsKeys.detail(id), updatedMaterial);
      queryClient.setQueriesData<Material[]>(
        { predicate: isMaterialListCache },
        (old) => old?.map((m) => (m.id === id ? updatedMaterial : m))
      );
      queryClient.invalidateQueries({ queryKey: materialsKeys.stock(id) });
      queryClient.invalidateQueries({ predicate: isLowStockCache });
    },
    onError: (error) => {
      logger.error('Failed to update material:', error);
    },
  });
};

/**
 * Deletes a material by ID.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * On success:
 * - `removeQueries(materialsKeys.detail(id))` — entity is gone; refetch
 *   would 404.
 * - `removeQueries(materialsKeys.stock(id))` — stock view is keyed by the
 *   now-deleted material.
 * - `setQueriesData({ predicate: isMaterialListCache }, filter)` — drops
 *   the deleted material from every list cache (`list`, `search`,
 *   `paginated`) without a refetch.
 * - `invalidateQueries({ predicate: isLowStockCache })` — the low-stock
 *   pages are counted on the server, so a deleted material leaves them
 *   holding a count that is one too many.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the numeric ID of the material to delete.
 */
export const useDeleteMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => materialsService.delete(id),
    onSuccess: (_data, id) => {
      // DELETE /materials/web/{id} → ApiResponse (ack).
      // Material gone — evict detail and stock caches; filter from every list.
      queryClient.removeQueries({ queryKey: materialsKeys.detail(id) });
      queryClient.removeQueries({ queryKey: materialsKeys.stock(id) });
      queryClient.setQueriesData<Material[]>(
        { predicate: isMaterialListCache },
        (old) => old?.filter((m) => m.id !== id)
      );
      queryClient.invalidateQueries({ predicate: isLowStockCache });
    },
    onError: (error) => {
      logger.error('Failed to delete material:', error);
    },
  });
};

/**
 * Creates or updates the threshold override for one storage location.
 *
 * Backend response: `MaterialLocationThresholdDto` (full row).
 *
 * On success:
 * - `setQueryData(materialsKeys.locationThresholds(materialId), upsert)` —
 *   replaces the row for the returned `storageLocationId` in the cached
 *   list, or appends it when no row for that location was present yet, so
 *   both create and update land without a refetch.
 * - `invalidateQueries(materialsKeys.stock(materialId))` — an edited
 *   threshold can change the material's stock-availability status, which
 *   the stock view derives.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ materialId: number; storageLocationId: number; data: MaterialLocationThresholdUpsert }`.
 */
export const useUpsertMaterialLocationThreshold = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      materialId,
      storageLocationId,
      data,
    }: {
      materialId: number;
      storageLocationId: number;
      data: MaterialLocationThresholdUpsert;
    }) =>
      materialsService.upsertLocationThreshold(
        materialId,
        storageLocationId,
        data
      ),
    onSuccess: (upserted, { materialId }) => {
      // PUT /materials/web/{materialId}/location-thresholds/{storageLocationId}
      // → MaterialLocationThresholdDto (full row). Upsert into the cached
      // list (replace matching storageLocationId or append). Invalidate the
      // stock view — a threshold change can shift stock-availability status.
      queryClient.setQueryData<MaterialLocationThreshold[]>(
        materialsKeys.locationThresholds(materialId),
        (old) => {
          if (!old) return [upserted];
          const exists = old.some(
            (t) => t.storageLocationId === upserted.storageLocationId
          );
          return exists
            ? old.map((t) =>
                t.storageLocationId === upserted.storageLocationId
                  ? upserted
                  : t
              )
            : [...old, upserted];
        }
      );
      queryClient.invalidateQueries({
        queryKey: materialsKeys.stock(materialId),
      });
      queryClient.invalidateQueries({ predicate: isLowStockCache });
    },
    onError: (error) => {
      logger.error('Failed to upsert material location threshold:', error);
    },
  });
};

/**
 * Deletes the threshold override for one storage location, reverting it to
 * the material-level defaults.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * On success:
 * - `setQueryData(materialsKeys.locationThresholds(materialId), filter)` —
 *   drops the row for the deleted `storageLocationId` from the cached list
 *   without a refetch.
 * - `invalidateQueries(materialsKeys.stock(materialId))` — removing an
 *   override reverts the location to material defaults, which can shift the
 *   stock-availability status the stock view derives.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ materialId: number; storageLocationId: number }`.
 */
export const useDeleteMaterialLocationThreshold = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      materialId,
      storageLocationId,
    }: {
      materialId: number;
      storageLocationId: number;
    }) =>
      materialsService.deleteLocationThreshold(materialId, storageLocationId),
    onSuccess: (_data, { materialId, storageLocationId }) => {
      // DELETE /materials/web/{materialId}/location-thresholds/{storageLocationId}
      // → ApiResponse (ack). Filter the row from the cached list; invalidate
      // the stock view since reverting to defaults can shift status.
      queryClient.setQueryData<MaterialLocationThreshold[]>(
        materialsKeys.locationThresholds(materialId),
        (old) => old?.filter((t) => t.storageLocationId !== storageLocationId)
      );
      queryClient.invalidateQueries({
        queryKey: materialsKeys.stock(materialId),
      });
      queryClient.invalidateQueries({ predicate: isLowStockCache });
    },
    onError: (error) => {
      logger.error('Failed to delete material location threshold:', error);
    },
  });
};
