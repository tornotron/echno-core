/**
 * @module shift-timing-keys
 *
 * TanStack Query key factory for the shift-timing domain.
 *
 * Key shapes:
 * - `['shift-timings']` — namespace root; never used as a query key
 *   directly. Use only as an invalidation prefix when you need to
 *   blast every shift-timing cache.
 * - `['shift-timings', 'list']` — the flat list of every configured
 *   shift timing, consumed by {@link useShifts}.
 * - `['shift-timings', 'detail', id]` — a single shift timing by ID,
 *   consumed by {@link useShift}.
 */
export const shiftTimingKeys = {
  /** Namespace root — never use as a query key directly. */
  all: ['shift-timings'] as const,

  /** Query key for the flat list of every configured shift timing. */
  lists: () => [...shiftTimingKeys.all, 'list'] as const,

  /** Query key for a single shift timing by ID. */
  detail: (id: number) => [...shiftTimingKeys.all, 'detail', id] as const,
};
