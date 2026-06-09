/**
 * @module use-storage-locations
 *
 * TanStack Query hooks for reading storage locations. Mutations live in
 * {@link useCreateStorageLocation}, {@link useUpdateStorageLocation}, and
 * {@link useDeleteStorageLocation}.
 */

import { useQuery } from '@tanstack/react-query';
import { storageLocationsService } from '../../services/storage-locations-service';
import { storageLocationKeys } from './storage-location-keys';

/**
 * Fetches every storage location.
 *
 * Cache options are inherited from the global `QueryClient` defaults — no
 * profile from `lib/query/options.ts` is spread in. Callers that need
 * static-reference-data semantics (`staleTime` 10 min, `gcTime` 30 min)
 * should override at the call site or compose the **static** profile.
 *
 * @returns A TanStack `UseQueryResult` wrapping `StorageLocation[]`.
 */
export const useStorageLocations = () =>
  useQuery({
    queryKey: storageLocationKeys.lists(),
    queryFn: () => storageLocationsService.getAll(),
  });

/**
 * Fetches a single storage location by ID.
 *
 * Cache options are inherited from the global `QueryClient` defaults. The
 * query is disabled until `id` is truthy, so passing `0` defers the fetch
 * without triggering an error.
 *
 * @param id - Surrogate ID of the storage location.
 * @returns A TanStack `UseQueryResult` wrapping a single `StorageLocation`.
 */
export const useStorageLocation = (id: number) =>
  useQuery({
    queryKey: storageLocationKeys.detail(id),
    queryFn: () => storageLocationsService.getById(id),
    enabled: !!id,
  });
