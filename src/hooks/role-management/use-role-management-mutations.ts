import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Employee, getOrgRoleLabel, OrgRole } from '../../types/employee';
import { roleManagementService } from '../../services/role-management-service';
import { employeeKeys } from '../employee';
import { logger} from '../../lib/logger';

/**
 * @module use-role-management-mutations
 *
 * Write-side hooks for the role-management module: {@link useAssignRole}
 * and {@link useUnassignRole}. Both target the Keycloak Group Controller
 * Web endpoints and write against the `employee` module's cache — the
 * module has no own query namespace.
 */

/**
 * Matches every Employee[] list cache under the 'employees' namespace.
 * Mirrors the predicate in `use-employee-mutations.ts`; kept inline here
 * because cross-importing from a sibling mutation file would couple the
 * modules unnecessarily.
 */
function isEmployeeListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return Array.isArray(key) && key[0] === 'employees' && key[1] !== 'detail';
}

/**
 * Assigns an organization role to an employee.
 *
 * Backend response: `ApiResponse` (ack). The body carries no payload, so
 * `onSuccess` patches the cached employee directly from the request
 * parameters (`employeeId`, `orgRole`).
 *
 * On success:
 * - `setQueryData(employeeKeys.detail(employeeId), append)` — appends
 *   `orgRole` to the cached employee's `orgRoles`, only if absent
 *   (idempotent: re-assigning an existing role does not duplicate it).
 * - `setQueriesData({ predicate: isEmployeeListCache }, append)` — mirrors
 *   the same idempotent append across every `Employee[]` list cache.
 *
 * No evictions. No invalidations kept — the ack response leaves nothing to
 * refetch; the direct patch keeps the {@link useRoleManagement} consumer
 * (which reads `employee.orgRoles` from these same caches) in sync.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   `{ employeeId: number; orgRole: OrgRole }`.
 */
export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      orgRole,
    }: {
      employeeId: number;
      orgRole: OrgRole;
    }) => roleManagementService.assignRole(employeeId, orgRole),
    onSuccess: (_data, { employeeId, orgRole }) => {
      // Patch the cached employee's orgRoles array — append if not already
      // present. Detail cache.
      queryClient.setQueryData<Employee>(
        employeeKeys.detail(employeeId),
        (old) =>
          old
            ? {
                ...old,
                orgRoles: old.orgRoles?.includes(orgRole)
                  ? old.orgRoles
                  : [...(old.orgRoles ?? []), orgRole],
              }
            : old
      );
      // Mirror across every Employee[] list cache.
      queryClient.setQueriesData<Employee[]>(
        { predicate: isEmployeeListCache },
        (old) =>
          old?.map((e) =>
            e.id === employeeId
              ? {
                  ...e,
                  orgRoles: e.orgRoles?.includes(orgRole)
                    ? e.orgRoles
                    : [...(e.orgRoles ?? []), orgRole],
                }
              : e
          )
      );
    },
    onError: (error: Error) => {
      logger.error('Failed to assign role', {
        description: error.message,
      });
    },
  });
}

/**
 * Unassigns an organization role from an employee.
 *
 * Backend response: `ApiResponse` (ack). The body carries no payload, so
 * `onSuccess` patches the cached employee directly from the request
 * parameters (`employeeId`, `orgRole`).
 *
 * On success:
 * - `setQueryData(employeeKeys.detail(employeeId), filter)` — removes
 *   `orgRole` from the cached employee's `orgRoles` (no-op if the role was
 *   not present).
 * - `setQueriesData({ predicate: isEmployeeListCache }, filter)` — mirrors
 *   the same removal across every `Employee[]` list cache.
 *
 * No evictions. No invalidations kept — the ack response leaves nothing to
 * refetch; the direct patch keeps the {@link useRoleManagement} consumer in
 * sync. On removal, logs a success message via {@link logger}.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   `{ employeeId: number; orgRole: OrgRole }`.
 */
export function useUnassignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      orgRole,
    }: {
      employeeId: number;
      orgRole: OrgRole;
    }) => roleManagementService.unassignRole(employeeId, orgRole),
    onSuccess: (_data, { employeeId, orgRole }) => {
      // Filter the role from the cached employee's orgRoles array.
      queryClient.setQueryData<Employee>(
        employeeKeys.detail(employeeId),
        (old) =>
          old
            ? {
                ...old,
                orgRoles: (old.orgRoles ?? []).filter((r) => r !== orgRole),
              }
            : old
      );
      queryClient.setQueriesData<Employee[]>(
        { predicate: isEmployeeListCache },
        (old) =>
          old?.map((e) =>
            e.id === employeeId
              ? {
                  ...e,
                  orgRoles: (e.orgRoles ?? []).filter((r) => r !== orgRole),
                }
              : e
          )
      );
      logger.info('Role Removed', {
        description: `${getOrgRoleLabel(orgRole)} has been removed successfully.`,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to remove role', {
        description: error.message,
      });
    },
  });
}
