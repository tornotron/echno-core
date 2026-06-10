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
 *
 * The mutation file's `isMaterialListCache` predicate matches every
 * `Material[]` list cache (`list`, `search`, `paginated`) but excludes
 * single-material caches (`detail`, `stock`) — see the mutation hooks for
 * the cache-strategy details.
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
};
