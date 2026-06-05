/**
 * @module hooks/user/use-user
 *
 * Query hooks for the User domain.
 *
 * Exports:
 * - {@link useUser} — fetches the current authenticated user's profile.
 * - {@link useUserEmployees} — fetches every employee membership the current
 *   user holds across organizations.
 */

import { useQuery } from '@tanstack/react-query';
import { userService } from '../../services/user-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { userKeys } from './user-keys';

/**
 * Fetches the current authenticated user's profile.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min,
 * `refetchOnWindowFocus` in production only) with {@link shouldRetry}.
 * The query is enabled by default; pass `{ enabled: false }` to defer
 * until the auth token is available.
 *
 * Reads from the singleton {@link userKeys.all} cache, which is also
 * patched directly by every mutation in this module.
 *
 * @param options - Optional consumer overrides.
 * @param options.enabled - When `false`, the query is paused. Defaults to `true`.
 * @returns A TanStack `UseQueryResult` wrapping the current {@link User}.
 */
export function useUser(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: () => userService.getCurrentUser(),
    ...standardQueryOptions,
    retry: shouldRetry,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Fetches every {@link Employee} membership the current user holds across
 * organizations.
 *
 * Uses the **standard** query profile with {@link shouldRetry}; always
 * enabled because the backend endpoint requires no parameters.
 *
 * @returns A TanStack `UseQueryResult` wrapping `Employee[]`.
 */
export function useUserEmployees() {
  return useQuery({
    queryKey: userKeys.employees(),
    queryFn: () => userService.getUserEmployees(),
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
