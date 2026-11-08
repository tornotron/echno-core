/**
 * @module use-access-admin
 *
 * Query hooks for the Roles & Permissions screen: the catalog, the roles and
 * people's access.
 */

import { useQuery } from '@tanstack/react-query';
import { accessService } from '../../services/access-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions, staticQueryOptions } from '../../lib/query/options';
import { accessKeys } from './keys';

/**
 * Fetches the sections, areas, actions and scopes the matrix shows.
 *
 * Uses the **static** profile: the catalog changes only with a backend
 * release.
 *
 * @returns A TanStack `UseQueryResult` wrapping an {@link AccessCatalog}.
 */
export const useAccessCatalog = () =>
  useQuery({
    queryKey: accessKeys.catalog(),
    queryFn: () => accessService.getCatalog(),
    ...staticQueryOptions,
    retry: shouldRetry,
  });

/**
 * Fetches the organization's roles, the baseline role first.
 *
 * @returns A TanStack `UseQueryResult` wrapping `AccessRole[]`.
 */
export const useAccessRoles = () =>
  useQuery({
    queryKey: accessKeys.roles(),
    queryFn: () => accessService.getRoles(),
    ...standardQueryOptions,
    retry: shouldRetry,
  });

/**
 * Fetches every employee with the roles and grants given to them directly.
 *
 * @returns A TanStack `UseQueryResult` wrapping `AccessUser[]`.
 */
export const useAccessUsers = () =>
  useQuery({
    queryKey: accessKeys.users(),
    queryFn: () => accessService.getUsers(),
    ...standardQueryOptions,
    retry: shouldRetry,
  });
