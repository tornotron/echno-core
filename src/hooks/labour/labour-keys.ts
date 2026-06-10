/**
 * @module labour-keys
 *
 * TanStack Query key factory for the labour domain.
 *
 * Key shapes:
 * - `['labour']` — namespace root, invalidation prefix only; never used as
 *   a query key directly.
 * - `['labour', 'list']` — the full collection (one cache entry shared by
 *   {@link useLabour}).
 * - `['labour', 'detail', id]` — a single labour record by ID, consumed by
 *   {@link useLabourById}.
 */
export const labourKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['labour'] as const,

  /** Query key for the full labour list. */
  lists: () => [...labourKeys.all, 'list'] as const,

  /** Query key for a single labour record by ID. */
  detail: (id: number) => [...labourKeys.all, 'detail', id] as const,
};
