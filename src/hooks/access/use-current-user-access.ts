/**
 * @module use-current-user-access
 *
 * Query hook for what the signed-in member may do in their current
 * organization, from the access matrix.
 */

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accessService } from '../../services/access-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { AccessScope, holdsPermission } from '../../types/access/current-user-access';
import { accessKeys } from './keys';

/**
 * Fetches the signed-in member's access and answers `can(area, action)`
 * against it, for showing or hiding pages and buttons that mirror a backend
 * `@access.can(area, action)` check.
 *
 * Uses the **standard** query profile (`staleTime` 1 min): an administrator's
 * change to someone's roles should reach their screen within a minute or on
 * the next focus, without a reload.
 *
 * `can` returns false while the access is loading or failed to load, so a
 * gate fails closed. Read `isLoading` first and hold the page, so a permitted
 * member does not see a flash of "Access Denied".
 *
 * @returns `access` (the {@link CurrentUserAccess}, or `undefined` while
 *   loading), `can(area, action, scope?)`, `isLoading` and `error`.
 */
export function useCurrentUserAccess() {
  const { data: access, isLoading, error } = useQuery({
    queryKey: accessKeys.currentUser(),
    queryFn: () => accessService.getCurrentUserAccess(),
    ...standardQueryOptions,
    retry: shouldRetry,
  });

  const can = useCallback(
    (area: string, action: string, scope?: AccessScope) => holdsPermission(access, area, action, scope),
    [access]
  );

  return { access, can, isLoading, error };
}
