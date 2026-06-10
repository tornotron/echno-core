/**
 * @module use-materials-mutations
 *
 * TanStack mutation hooks for the materials domain — create, update, and
 * delete. Read-side hooks live in {@link useMaterials},
 * {@link useMaterialsPaginated}, {@link useMaterialSearch},
 * {@link useMaterial}, and {@link useMaterialWithStock}.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { materialsService } from '../../services/materials-service';
import { materialsKeys } from './keys';
import {
  CreateMaterialRequest,
  UpdateMaterialRequest,
  Material,
} from '../../types/materials';
import { logger } from '../../lib/logger';

/**
 * Matches every `Material[]` list cache under the `materials` namespace,
 * spanning `lists()`, `search(name)`, and `paginated({ pageNo, pageSize })`.
 * `materialsService.getAllPaginated` flattens `PageMaterialDto` to
 * `Material[]` so all three caches share the same data shape and a single
 * predicate covers them.
 *
 * Excludes single-material caches `detail(id)` (Material) and `stock(id)`
 * (MaterialStock), which the mutations address by their own key shapes.
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to a material list cache.
 */
function isMaterialListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'materials' &&
    key[1] !== 'detail' &&
    key[1] !== 'stock'
  );
}

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
 *   `MaterialStock`, not `MaterialDto`, and edited material fields (e.g.
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
 *
 * No invalidations are kept: with the entity gone, every consequence of
 * the delete is local-cache cleanup.
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
    },
    onError: (error) => {
      logger.error('Failed to delete material:', error);
    },
  });
};
