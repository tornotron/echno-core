/**
 * TanStack Query key factory for the Computer Vision domain.
 *
 * Key shapes:
 * - `['vision']`: namespace root; the invalidation prefix.
 * - `['vision', 'models']`: every model family with its versions.
 * - `['vision', 'models', key, 'versions', version]`: one version.
 * - `['vision', 'settings']`: the organization's inference settings.
 */
export const visionKeys = {
  all: ['vision'] as const,
  models: () => [...visionKeys.all, 'models'] as const,
  modelVersion: (key: string, version: string) =>
    [...visionKeys.models(), key, 'versions', version] as const,
  settings: () => [...visionKeys.all, 'settings'] as const,
};
