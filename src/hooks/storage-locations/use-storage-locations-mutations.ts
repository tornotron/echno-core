/**
 * hooks/storage-locations/use-storage-locations-mutations.ts
 *
 * React Query mutation hooks for storage locations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storageLocationsService } from '../../services/storage-locations-service';
import { storageLocationKeys } from './storage-location-keys';
import { logger } from '../../lib/logger';
import {
  CreateStorageLocationRequest,
  UpdateStorageLocationRequest,
  StorageLocation,
} from '../../types/storage-locations';

/**
 * Matches every StorageLocation[] list cache under the 'storage-locations'
 * namespace. Currently scopes to `lists()` (`['storage-locations', 'list']`),
 * but the predicate excludes only `detail(id)` so any future shapes
 * (`byProject(id)`, `byType(t)`, `paginated(...)`) are picked up automatically
 * when added.
 */
function isStorageLocationListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) && key[0] === 'storage-locations' && key[1] !== 'detail'
  );
}

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
