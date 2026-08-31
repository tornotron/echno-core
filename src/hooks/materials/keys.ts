/**
 * @module material-keys
 *
 * TanStack Query key factory for the materials domain.
 *
 * Key shapes:
 * - `['materials']` — namespace root, invalidation prefix only; never used
 *   as a query key directly.
 * - `['materials', 'list']` — the unpaginated material list, consumed by
 *   {@link useMaterials}.
 * - `['materials', 'detail', id]` — a single material by ID, consumed by
 *   {@link useMaterial}.
 * - `['materials', 'stock', id]` — a single material with non-null
 *   `currentStock`, consumed by {@link useMaterialWithStock}.
 * - `['materials', 'search', name]` — name-scoped search results, consumed
 *   by {@link useMaterialSearch}.
 * - `['materials', 'paginated', { pageNo, pageSize }]` — paginated list,
 *   consumed by {@link useMaterialsPaginated}.
 * - `['materials', 'page', { pageNo, pageSize }]` — a page of materials
 *   with the envelope kept, consumed by {@link useMaterialsPage}. Holds a
 *   `PagedMaterials` envelope, not `Material[]`: the catalogue size lives
 *   on it.
 * - `['materials', 'low-stock', { projectId, storageLocationId, pageNo, pageSize }]`
 *   — a page of the materials at or below their reorder level, consumed by
 *   {@link useLowStockMaterials}. Holds a `PagedLowStockMaterials`
 *   envelope, not `Material[]`: the count lives on it.
 * - `['materials', 'location-thresholds', materialId]` — per-storage-location
 *   threshold overrides for a material, consumed by
 *   {@link useMaterialLocationThresholds}. Holds
 *   `MaterialLocationThreshold[]`, not `Material[]`.
 *
 * The mutation file's `isMaterialListCache` predicate matches every
 * `Material[]` list cache (`list`, `search`, `paginated`) but excludes
 * single-material caches (`detail`, `stock`), the `location-thresholds`
 * cache (a different row shape), and the two envelope caches `page` and
 * `low-stock` — see the mutation hooks for the cache-strategy details.
 */
export const materialsKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['materials'] as const,

  /** Query key for the unpaginated material list. */
  lists: () => [...materialsKeys.all, 'list'] as const,

  /** Query key for a single material by ID. */
  detail: (id: number) => [...materialsKeys.all, 'detail', id] as const,

  /** Query key for a single material with non-null `currentStock`. */
  stock: (id: number) => [...materialsKeys.all, 'stock', id] as const,

  /** Query key for a material search by name. */
  search: (name: string) => [...materialsKeys.all, 'search', name] as const,

  /** Query key for a paginated material list. */
  paginated: (pageNo: number, pageSize: number) =>
    [...materialsKeys.all, 'paginated', { pageNo, pageSize }] as const,

  /** Query key for a page of materials with its envelope kept. */
  page: (params: { pageNo?: number; pageSize?: number }) =>
    [...materialsKeys.all, 'page', params] as const,

  /** Query key for a material's per-location threshold overrides. */
  locationThresholds: (materialId: number) =>
    [...materialsKeys.all, 'location-thresholds', materialId] as const,

  /** Query key for a page of materials at or below their reorder level. */
  lowStock: (params: {
    projectId?: number;
    storageLocationId?: number;
    pageNo?: number;
    pageSize?: number;
  }) => [...materialsKeys.all, 'low-stock', params] as const,
};
