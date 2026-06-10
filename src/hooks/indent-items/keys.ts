/**
 * @module indent-item-keys
 *
 * TanStack Query key factory for the indent-items sub-domain.
 *
 * Key shapes:
 * - `['indent-items']` — namespace root, invalidation prefix only;
 *   never used as a query key directly.
 * - `['indent-items', 'list']` — the unpaginated indent-item list,
 *   consumed by {@link useIndentItems}.
 * - `['indent-items', 'detail', id]` — a single line item by ID,
 *   consumed by {@link useIndentItem}.
 * - `['indent-items', 'indent', indentId]` — every line item belonging
 *   to one parent indent, consumed by {@link useIndentItemsByIndent}.
 *   Also evicted on `useDeleteIndent` so a deleted parent doesn't
 *   leave its items cached.
 *
 * Note: in the current UI, the parent indent's `items` array is the
 * primary source of truth — line-item mutations patch the parent's
 * `detail(indentId)` cache directly (see
 * {@link useCreateIndentItem}, {@link useUpdateIndentItem},
 * {@link useDeleteIndentItem}, {@link useMarkIndentItemConverted}).
 */

export const indentItemKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['indent-items'] as const,

  /** Query key for the unpaginated indent-item list. */
  lists: () => [...indentItemKeys.all, 'list'] as const,

  /** Query key for a single indent line item by ID. */
  detail: (id: number) => [...indentItemKeys.all, 'detail', id] as const,

  /** Query key for every line item belonging to one parent indent. */
  byIndent: (indentId: number) =>
    [...indentItemKeys.all, 'indent', indentId] as const,
};
