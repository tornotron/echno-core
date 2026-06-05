/**
 * @module hooks/user/use-user
 *
 * Query hooks for the User domain.
 *
 * Exports:
 * - {@link useUser} — fetches the current authenticated user's profile.
 *
 * `useUserEmployees` is intentionally absent — it depends on the Employee
 * type which has not yet migrated. It lives in echno-web until the employee
 * module ships.
 */

import { useQuery } from '@tanstack/react-query';
import { userService } from '../../services/user-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { userKeys } from './user-keys';

/**
 * Fetches the current authenticated user's profile.
 *
 * Uses the **standard** query profile (staleTime 60 s, gcTime 5 min,
 * `refetchOnWindowFocus` in production only) plus {@link shouldRetry} for
 * retry classification. The profile is prefetched on login by
 * `UserPrefetcher`, so the first observation typically hits cache rather
 * than the network.
 *
 * @param options - Optional flag bag; pass `enabled: false` to defer the
 *   query (e.g. before authentication completes). Defaults to enabled.
 * @returns A TanStack `UseQueryResult` wrapping a {@link User}.
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
