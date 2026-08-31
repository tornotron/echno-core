/**
 * @module material-cache-predicates
 *
 * The two cache predicates the material mutations pass to TanStack Query.
 *
 * Internal to the materials hooks: not re-exported from `./index`, so they
 * are not part of the package's public surface. They live in their own
 * module because what they match is a correctness property, not a
 * convenience, and it is worth testing on its own.
 */

/**
 * Matches every `Material[]` list cache under the `materials` namespace,
 * spanning `lists()`, `search(name)`, and `paginated({ pageNo, pageSize })`.
 * `materialsService.getAllPaginated` flattens `PageMaterialDto` to
 * `Material[]` so all three caches share the same data shape and a single
 * predicate covers them.
 *
 * Excludes single-material caches `detail(id)` (Material) and `stock(id)`
 * (MaterialWithStock), the `location-thresholds` cache
 * (MaterialLocationThreshold[], a different row shape), and the two
 * envelope caches `page` (a `PagedMaterials`) and `low-stock` (a
 * `PagedLowStockMaterials`), neither of which is an array at all. The
 * mutations address all of those by their own key shapes.
 *
 * The exclusion list is what a new key shape has to be added to. This
 * predicate matches by what it is *not*, so a cache added under the
 * namespace and forgotten here is matched by default and handed to an
 * updater that will call `.map` on it.
 *
 * The exclusions are what makes the predicate safe rather than merely
 * tidy: the updaters it is passed to call `.map` and `.filter` on whatever
 * they match, so a cache holding anything but a `Material[]` would throw
 * inside the mutation's `onSuccess`.
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to a material list cache.
 */
export function isMaterialListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'materials' &&
    key[1] !== 'detail' &&
    key[1] !== 'stock' &&
    key[1] !== 'location-thresholds' &&
    key[1] !== 'page' &&
    key[1] !== 'low-stock'
  );
}

/**
 * Matches every materials page cache under the `materials` namespace.
 *
 * How many materials the catalogue holds is a number only the server has,
 * so a mutation that adds or removes one invalidates these rather than
 * patching them. Patching would mean adjusting `totalElements` by hand,
 * which reintroduces a client-side count of the catalogue by a longer
 * route.
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to a materials page cache.
 */
export function isMaterialPageCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return Array.isArray(key) && key[0] === 'materials' && key[1] === 'page';
}

/**
 * Matches every low-stock page cache under the `materials` namespace.
 *
 * Which materials are low, and how many, is decided on the server against
 * stock the client does not hold, so a mutation that can change the answer
 * invalidates these rather than patching them.
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to a low-stock page cache.
 */
export function isLowStockCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return Array.isArray(key) && key[0] === 'materials' && key[1] === 'low-stock';
}
