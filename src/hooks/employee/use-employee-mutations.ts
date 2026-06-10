/**
 * @module hooks/employee/use-employee-mutations
 *
 * Mutation hooks for the Employee domain.
 *
 * Six mutations covering the full lifecycle plus manager-reassignment:
 * - {@link useCreateEmployee} — **deprecated** fail-fast (backend endpoint
 *   does not exist).
 * - {@link useUpdateEmployee} — 3-way guarded patch over a spec/service drift.
 * - {@link useDeleteEmployee} — ack-response delete with cross-namespace user
 *   invalidate.
 * - {@link useJoinOrganization} — full-DTO seed + 3-way cross-namespace fan-out.
 * - {@link useAssignManager} / {@link useRemoveManager} — full-DTO direct
 *   patch + subordinates predicate scan.
 *
 * Module-level helpers:
 * - {@link isEmployeeListCache} predicate spans every `Employee[]` cache
 *   shape (`lists()`, `subordinates(*)`, `managers()`, `managersByOrg(*)`)
 *   while excluding `detail(id)`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../../services/employee-service';
import { Employee } from '../../types/employee';
import { CreateEmployeeRequest } from '../../types/employee/employee-create';
import { UpdateEmployeeRequest } from '../../types/employee/employee-update';
import { employeeKeys } from './keys';
import { organizationKeys } from '../organization/organization-keys';
import { userKeys } from '../user/user-keys';

/**
 * Matches every `Employee[]` list cache under the `'employees'` namespace:
 * `lists()`, `subordinates(managerId)`, `managers()`, `managersByOrg(orgId)`.
 * Excludes `detail(id)` (third segment after `'detail'`).
 *
 * @param query - The query entry being inspected by TanStack.
 * @returns `true` when the cache holds an `Employee[]` and should be patched.
 */
function isEmployeeListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return Array.isArray(key) && key[0] === 'employees' && key[1] !== 'detail';
}

/**
 * Reserved for direct employee creation once the backend exposes a plain
 * `POST /employee/web` endpoint.
 *
 * Backend response: none — endpoint does not exist (audited 2026-06-02).
 *
 * On invoke: throws synchronously with a message directing callers to
 * {@link useJoinOrganization}; the error surfaces through the standard
 * `useMutation` error path. Callers are responsible for surfacing feedback.
 *
 * @deprecated The backend has no plain `POST /employee/web` endpoint per
 *   the live OpenAPI spec (audited 2026-06-02). Use
 *   {@link useJoinOrganization} to add an existing user as an employee of
 *   an organization. Do not call from new code.
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   a {@link CreateEmployeeRequest} and always throws.
 */
export function useCreateEmployee() {
  return useMutation({
    mutationFn: async (_dto: CreateEmployeeRequest): Promise<Employee> => {
      throw new Error(
        'Direct employee creation is not supported by the backend (no POST /employee/web endpoint). Use useJoinOrganization to add an existing user as an employee of an organization.'
      );
    },
  });
}

/**
 * Updates an existing employee.
 *
 * Backend response: spec labels `ApiResponse` (ack); the live service
 * parses an `EmployeeDto`-shaped body. The same drift pattern as
 * `useActivateLeavePolicy`, `useUpdatePOStatus`, and
 * `useUpdateSiteTransferStatus`.
 *
 * On success — 3-way guarded patch, in order:
 * 1. `setQueryData(employeeKeys.detail(id), data)` + predicate-map
 *    `isEmployeeListCache` — when the response carries a numeric `data.id`
 *    (full DTO returned).
 * 2. Otherwise, merge `requestData` fields onto the cached detail and
 *    re-write detail + lists — when only a cached base is available.
 * 3. Otherwise, `invalidateQueries(employeeKeys.detail(id))` +
 *    `invalidateQueries({ predicate: isEmployeeListCache })` — last-resort
 *    refetch.
 *
 * No invalidations are kept on the happy path. The fallback invalidations
 * exist only when neither the response nor the cache can supply a patched
 * value.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; data: UpdateEmployeeRequest }`.
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateEmployeeRequest }) =>
      employeeService.update(id, data),
    onSuccess: (data, { id, data: requestData }) => {
      // FIXME: spec says ApiResponse, service parses as Employee. Confirm
      // backend response shape and align service signature (Promise<void>)
      // if spec is authoritative.
      const cachedDetail = queryClient.getQueryData<Employee>(
        employeeKeys.detail(id)
      );

      if (data && typeof data.id === 'number') {
        queryClient.setQueryData(employeeKeys.detail(id), data);
        queryClient.setQueriesData<Employee[]>(
          { predicate: isEmployeeListCache },
          (old) => old?.map((e) => (e.id === id ? data : e))
        );
      } else if (cachedDetail) {
        // Service drift fallback: merge request fields onto cached detail.
        const patched: Employee = {
          ...cachedDetail,
          ...requestData,
        } as Employee;
        queryClient.setQueryData(employeeKeys.detail(id), patched);
        queryClient.setQueriesData<Employee[]>(
          { predicate: isEmployeeListCache },
          (old) => old?.map((e) => (e.id === id ? patched : e))
        );
      } else {
        queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id) });
        queryClient.invalidateQueries({ predicate: isEmployeeListCache });
      }

      const displayName =
        (data && typeof data.id === 'number'
          ? data.name
          : cachedDetail?.name) || 'Employee';
    },
  });
}

/**
 * Deletes an employee.
 *
 * Backend response: `ApiResponse` (ack).
 *
 * On success:
 * - `removeQueries(employeeKeys.detail(id))` — evicts detail; entity no
 *   longer exists.
 * - `setQueriesData<Employee[]>({ predicate: isEmployeeListCache }, filter)` —
 *   strips the row from every list cache shape simultaneously.
 * - `invalidateQueries(userKeys.all)` — kept (cross-namespace): if the
 *   deleted employee was the current user's own (matching
 *   `defaultOrganizationId`), user identity context changes. Conservative;
 *   over-invalidates for non-self deletes but cheap (single singleton key).
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   the employee ID directly.
 */
export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => employeeService.delete(id),
    onSuccess: (_, id) => {
      // Evict detail + filter from list caches.
      queryClient.removeQueries({ queryKey: employeeKeys.detail(id) });
      queryClient.setQueriesData<Employee[]>(
        { predicate: isEmployeeListCache },
        (old) => old?.filter((e) => e.id !== id)
      );
      // Cross-namespace: user.defaultOrganizationId or user.attachments may
      // change if the deleted employee was the user's own. Invalidate
      // userKeys.all conservatively.
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

/**
 * Provisions a new employee record for a user joining an organization.
 *
 * Backend response: `EmployeeDto` (full).
 *
 * On success:
 * - `setQueryData(employeeKeys.detail(newEmployee.id), newEmployee)` — seeds detail.
 * - `setQueryData<Employee[]>(employeeKeys.lists(), append)` — appends the
 *   new employee to the main list cache (no-op if list never observed).
 * - `invalidateQueries(userKeys.all)` — kept (cross-namespace): the joining
 *   user gains a new employee record; their identity context refetches.
 * - `invalidateQueries(userKeys.employees())` — kept (cross-namespace):
 *   user-prefetched employee list needs the new row.
 * - `invalidateQueries(organizationKeys.all)` — kept (cross-namespace):
 *   organization gains a member; embedded counts and member arrays drift.
 *
 * No optimistic update — the new employee ID is server-assigned.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ userId: number; organizationId: number }`.
 */
export function useJoinOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      organizationId,
    }: {
      userId: number;
      organizationId: number;
    }) => employeeService.joinOrganization(userId, organizationId),
    onSuccess: (newEmployee) => {
      // Seed detail + predicate-append to list caches.
      queryClient.setQueryData(
        employeeKeys.detail(newEmployee.id),
        newEmployee
      );
      queryClient.setQueryData<Employee[]>(employeeKeys.lists(), (old) =>
        old ? [...old, newEmployee] : [newEmployee]
      );
      // Cross-namespace: the joining user gains an employee profile + may
      // need defaultOrganizationId updated. Organization gains a member.
      // Invalidate both for canonical refetch.
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.employees() });
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}

/**
 * Assigns a reporting manager to an employee.
 *
 * Backend response: `EmployeeDto` (full).
 *
 * On success:
 * - `setQueryData(employeeKeys.detail(employeeId), employee)` — direct patch
 *   with the server-returned employee.
 * - `setQueriesData<Employee[]>({ predicate: isEmployeeListCache }, mapReplace)` —
 *   updates every list cache shape that holds this employee.
 * - `invalidateQueries(employeeKeys.subordinates(managerId))` — kept: the
 *   new manager's subordinates list now includes this employee; refetch is
 *   simpler than appending in place.
 * - `invalidateQueries({ predicate: <subordinates predicate scan> })` — kept:
 *   the previous manager's subordinates list no longer includes this
 *   employee, and the previous managerId is not part of the mutation input.
 *   The safety-net scan is the same shape used for PO `byStatus` and
 *   site-transfer `byStatus` invalidations.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ employeeId: number; managerId: number }`.
 */
export function useAssignManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      managerId,
    }: {
      employeeId: number;
      managerId: number;
    }) => employeeService.assignManager(employeeId, managerId),
    onSuccess: (employee, { employeeId, managerId }) => {
      // Patch detail + predicate-replace lists.
      queryClient.setQueryData(employeeKeys.detail(employeeId), employee);
      queryClient.setQueriesData<Employee[]>(
        { predicate: isEmployeeListCache },
        (old) => old?.map((e) => (e.id === employeeId ? employee : e))
      );
      // The new manager's subordinates list now includes this employee.
      // Invalidate to refetch (we don't have the previous managerId to
      // remove from the old subordinates list).
      queryClient.invalidateQueries({
        queryKey: employeeKeys.subordinates(managerId),
      });
      // Also invalidate any other subordinates lists (predicate scan) —
      // safety net for the previous manager.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'employees' &&
          q.queryKey[1] === 'subordinates',
      });
    },
  });
}

/**
 * Removes the current reporting manager from an employee.
 *
 * Backend response: `EmployeeDto` (full).
 *
 * On success:
 * - `setQueryData(employeeKeys.detail(employeeId), employee)` — direct patch.
 * - `setQueriesData<Employee[]>({ predicate: isEmployeeListCache }, mapReplace)` —
 *   updates every list cache shape that holds this employee.
 * - `invalidateQueries({ predicate: <subordinates predicate scan> })` — kept:
 *   the previous manager's subordinates list needs the row removed, and
 *   the previous managerId is not part of the mutation input. Same
 *   safety-net pattern as {@link useAssignManager}.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   the employee ID directly.
 */
export function useRemoveManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employeeId: number) =>
      employeeService.removeManager(employeeId),
    onSuccess: (employee, employeeId) => {
      queryClient.setQueryData(employeeKeys.detail(employeeId), employee);
      queryClient.setQueriesData<Employee[]>(
        { predicate: isEmployeeListCache },
        (old) => old?.map((e) => (e.id === employeeId ? employee : e))
      );
      // Invalidate all subordinates lists (the employee was removed from
      // their previous manager's list, but we don't know which one).
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'employees' &&
          q.queryKey[1] === 'subordinates',
      });
    },
  });
}
