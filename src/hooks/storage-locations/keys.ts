/**
 * @module storage-location-keys
 *
 * TanStack Query key factory for the storage-location domain.
 *
 * Key shapes:
 * - `['storage-locations']` — namespace root, invalidation prefix only; never
 *   used as a query key directly.
 * - `['storage-locations', 'list']` — the full collection (one cache entry
 *   shared by {@link useStorageLocations}).
 * - `['storage-locations', 'detail', id]` — a single storage location by id,
 *   consumed by {@link useStorageLocation}.
 *
 * The list cache is identified by mutation hooks via the
 * `isStorageLocationListCache` predicate, which matches any key under the
 * namespace whose second segment is not `'detail'`. Any future list shapes
 * added here (e.g. `byProject(id)`) are automatically covered by that
 * predicate without changes to the mutation hooks.
 */
export const storageLocationKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['storage-locations'] as const,

  /** Query key for the full storage-location list. */
  lists: () => [...storageLocationKeys.all, 'list'] as const,

  /** Query key for a single storage location by ID. */
  detail: (id: number) => [...storageLocationKeys.all, 'detail', id] as const,
};
