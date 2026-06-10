/**
 * @module use-storage-locations-mutations
 *
 * TanStack mutation hooks for the storage-location domain. Read-side hooks
 * live in {@link useStorageLocations} and {@link useStorageLocation}.
 *
 * Every endpoint in this domain returns the full `StorageLocationDto`
 * (or an ack for delete), so each `onSuccess` patches the cache directly
 * and issues zero invalidations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storageLocationsService } from '../../services/storage-locations-service';
import { storageLocationKeys } from './keys';
import { logger } from '../../lib/logger';
import {
  CreateStorageLocationRequest,
  UpdateStorageLocationRequest,
  StorageLocation,
} from '../../types/storage-locations';

/**
 * Matches every `StorageLocation[]` list cache under the `storage-locations`
 * namespace. Currently scopes to `lists()` (`['storage-locations', 'list']`),
 * but the predicate excludes only `detail(id)` so any future shapes
 * (`byProject(id)`, `byType(t)`, `paginated(...)`) are picked up
 * automatically when added.
 *
 * @param query - The cached query under inspection.
 * @returns `true` when `query.queryKey` targets a list cache, `false` for
 *   detail caches or non-namespace keys.
 */
function isStorageLocationListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) && key[0] === 'storage-locations' && key[1] !== 'detail'
  );
}

/**
 * Creates a new storage location.
 *
 * Backend response: `StorageLocationDto` (full — `StorageLocation` is a flat
 * type with no nested arrays).
 *
 * On success:
 * - `setQueryData(storageLocationKeys.detail(newLocation.id), newLocation)` —
 *   seeds the detail cache with the server-returned object so an immediate
 *   read returns a value rather than triggering a fetch.
 * - `setQueryData(storageLocationKeys.lists(), append)` — appends the new
 *   location to the cached list, avoiding a full list refetch.
 *
 * No invalidations — the full DTO response is authoritative.
 *
 * Errors are logged via {@link logger}; the mutation result still surfaces
 * the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   a {@link CreateStorageLocationRequest}.
 */
export const useCreateStorageLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStorageLocationRequest) =>
      storageLocationsService.create(dto),
    onSuccess: (newLocation) => {
      // POST /storage-locations/web → StorageLocationDto (full).
      // Seed detail + append to main list. Zero invalidations.
      queryClient.setQueryData(
        storageLocationKeys.detail(newLocation.id),
        newLocation
      );
      queryClient.setQueryData<StorageLocation[]>(
        storageLocationKeys.lists(),
        (old) => (old ? [...old, newLocation] : [newLocation])
      );
    },
    onError: (error) => {
      logger.error('Failed to create storage location:', error);
    },
  });
};

/**
 * Updates an existing storage location.
 *
 * Backend response: `StorageLocationDto` (full).
 *
 * On success:
 * - `setQueryData(storageLocationKeys.detail(id), updatedLocation)` —
 *   replaces the cached detail with the server-returned object.
 * - `setQueriesData({ predicate: isStorageLocationListCache }, replace)` —
 *   updates the matching row in every cached list under the namespace.
 *
 * No invalidations — the full DTO response is authoritative.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; data: UpdateStorageLocationRequest }`.
 */
export const useUpdateStorageLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateStorageLocationRequest;
    }) => storageLocationsService.update(id, data),
    onSuccess: (updatedLocation, { id }) => {
      // PATCH /storage-locations/web/{id} → StorageLocationDto (full).
      // Patch detail + every list cache directly. Zero invalidations.
      queryClient.setQueryData(storageLocationKeys.detail(id), updatedLocation);
      queryClient.setQueriesData<StorageLocation[]>(
        { predicate: isStorageLocationListCache },
        (old) => old?.map((l) => (l.id === id ? updatedLocation : l))
      );
    },
    onError: (error) => {
      logger.error('Failed to update storage location:', error);
    },
  });
};

/**
 * Deletes a storage location.
 *
 * Backend response: `ApiResponse` (ack — no entity body).
 *
 * On success:
 * - `removeQueries(storageLocationKeys.detail(id))` — evicts the detail
 *   cache; the entity is gone, so a refetch would 404.
 * - `setQueriesData({ predicate: isStorageLocationListCache }, filter)` —
 *   removes the deleted row from every cached list under the namespace.
 *
 * No invalidations — the eviction and list filter together leave the cache
 * consistent without a network round-trip.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   the location ID to delete.
 */
export const useDeleteStorageLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => storageLocationsService.delete(id),
    onSuccess: (_data, id) => {
      // DELETE /storage-locations/web/{id} → ApiResponse (ack).
      // Entity gone — evict detail and filter from every list cache.
      queryClient.removeQueries({ queryKey: storageLocationKeys.detail(id) });
      queryClient.setQueriesData<StorageLocation[]>(
        { predicate: isStorageLocationListCache },
        (old) => old?.filter((l) => l.id !== id)
      );
    },
    onError: (error) => {
      logger.error('Failed to delete storage location:', error);
    },
  });
};
