/**
 * TanStack Query key factory for the Module domain.
 *
 * Key shapes:
 * - `['modules']` — namespace root; used as an invalidation prefix.
 * - `['modules', 'installed']` — every module the backend knows about.
 * - `['modules', 'enabled']` — modules enabled and entitled for the current
 *   org; the key data prefetched at auth bootstrap is set against, so the
 *   nav loader and any `ModuleGuard` can read it without a network round-trip.
 *
 * @see {@link useEnabledModules}
 * @see {@link useInstalledModules}
 */
export const moduleKeys = {
  all: ['modules'] as const,
  installed: () => [...moduleKeys.all, 'installed'] as const,
  enabled: () => [...moduleKeys.all, 'enabled'] as const,
};
