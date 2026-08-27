/**
 * @module search-keys
 *
 * TanStack Query key factory for quick search.
 *
 * Key shapes:
 * - `['search']` — namespace root. Invalidation prefix only.
 * - `['search', term, limit]` — one search result set. The term is part of
 *   the key so React Query caches each distinct query separately and a
 *   repeated search returns instantly rather than round-tripping again.
 */
export const searchKeys = {
  /** Invalidation prefix for the entire search namespace. */
  all: ['search'] as const,

  /** One search result set, keyed by term and row limit. */
  query: (term: string, limit?: number) =>
    [...searchKeys.all, term, limit ?? null] as const,
};
