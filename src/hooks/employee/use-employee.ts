/**
 * @module hooks/employee/use-employee
 *
 * Query hooks for the Employee domain.
 *
 * Exports:
 * - {@link useEmployees} — every employee visible to the caller.
 * - {@link useEmployee} — a single employee by ID.
 * - {@link useCurrentUserEmployee} — the active employee record for the
 *   current user, derived by joining {@link useUser} + {@link useUserEmployees}.
 * - {@link useSubordinates} — direct reports of one manager.
 * - {@link useManagers} — every employee that acts as a manager.
 *
 * All HTTP-backed hooks use the `standardQueryOptions` profile (staleTime
 * 60 s, gcTime 5 min, `refetchOnWindowFocus` in production only) plus the
 * canonical {@link shouldRetry} policy.
 */

import { useQuery } from '@tanstack/react-query';
import { employeeService } from '../../services/employee-service';
import { useUser, useUserEmployees } from '../user/use-user';

import { useMemo } from 'react';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { employeeKeys } from './keys';

/**
 * Fetches every employee visible to the caller.
 *
 * Uses the **standard** query profile + {@link shouldRetry}. Always enabled.
 *
 * @returns A TanStack `UseQueryResult` wrapping `Employee[]`.
 */
export function useEmployees() {
  return useQuery({
    queryKey: employeeKeys.lists(),
    queryFn: () => employeeService.getAll(),
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Fetches a single employee by surrogate ID.
 *
 * Uses the **standard** query profile + {@link shouldRetry}. The query is
 * disabled until `id` is truthy (i.e. non-zero, non-undefined).
 *
 * @param id - Surrogate ID of the employee.
 * @returns A TanStack `UseQueryResult` wrapping {@link Employee}.
 */
export function useEmployee(id: number) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => employeeService.getById(id),
    enabled: !!id,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Resolves the current user's active {@link Employee} record by joining
 * {@link useUser} (for `defaultOrganizationId`) with {@link useUserEmployees}
 * (the list of memberships).
 *
 * No own query — composes the two existing caches. The result re-derives
 * whenever the user's `defaultOrganizationId` or the employees list changes.
 * Prefetched on login by `UserPrefetcher`.
 *
 * @returns `{ data, isLoading, error }` shaped like a query hook, where
 *   `data` is the active employee or `undefined` when the user is not
 *   currently scoped to an organization.
 */
export function useCurrentUserEmployee() {
  const { data: user } = useUser();
  const { data: employees, isLoading, error } = useUserEmployees();

  const defaultOrgId = user?.defaultOrganizationId;

  const currentEmployee = useMemo(() => {
    if (!defaultOrgId || !employees) {
      return;
    }
    return employees.find((emp) => emp.organizationId === defaultOrgId);
  }, [defaultOrgId, employees]);

  return {
    data: currentEmployee,
    isLoading,
    error,
  };
}

/**
 * Fetches the direct reports of a manager.
 *
 * Uses the **standard** query profile + {@link shouldRetry}. The query is
 * disabled until `managerId` is provided; the `queryFn` throws defensively
 * if the runtime guard is bypassed.
 *
 * @param managerId - Surrogate ID of the manager. Pass `undefined` to defer
 *   the query.
 * @returns A TanStack `UseQueryResult` wrapping `Employee[]`.
 */
export function useSubordinates(managerId?: number) {
  return useQuery({
    queryKey: employeeKeys.subordinates(managerId),
    queryFn: () => {
      if (!managerId) {
        throw new Error('Manager ID is required');
      }
      return employeeService.getSubordinates(managerId);
    },
    enabled: !!managerId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Fetches every employee that acts as a manager (has at least one direct
 * report).
 *
 * Uses the **standard** query profile + {@link shouldRetry}. Always enabled.
 *
 * @returns A TanStack `UseQueryResult` wrapping `Employee[]`.
 */
export function useManagers() {
  return useQuery({
    queryKey: employeeKeys.managers(),
    queryFn: () => employeeService.getManagers(),
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
