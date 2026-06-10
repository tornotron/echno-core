/**
 * @module indents-keys
 *
 * TanStack Query key factory for the indents domain.
 *
 * Key shapes:
 * - `['indents']` — namespace root, invalidation prefix only; never used
 *   as a query key directly.
 * - `['indents', 'list']` — the unpaginated indent list, consumed by
 *   {@link useIndents}.
 * - `['indents', 'detail', id]` — a single indent by ID, consumed by
 *   {@link useIndent}. The detail cache is the source of truth for
 *   embedded `items`; line-item mutations patch this entry.
 * - `['indents', 'paginated', { pageNo, pageSize }]` — paginated list,
 *   consumed by {@link useIndentsPaginated}.
 *
 * The mutation file's `isIndentListCache` predicate matches every
 * `Indent[]` list cache (`list`, `paginated`) but excludes both
 * `detail` and the `items` sub-namespace (which belongs to the
 * indent-items module — see {@link indentItemKeys}).
 */

export const indentsKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['indents'] as const,

  /** Query key for the unpaginated indent list. */
  lists: () => [...indentsKeys.all, 'list'] as const,

  /** Query key for a single indent by ID (carries the embedded `items` array). */
  detail: (id: number) => [...indentsKeys.all, 'detail', id] as const,

  /** Query key for a paginated indent list. */
  paginated: (pageNo: number, pageSize: number) =>
    [...indentsKeys.all, 'paginated', { pageNo, pageSize }] as const,
};
