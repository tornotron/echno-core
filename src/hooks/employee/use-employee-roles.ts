/**
 * @module hooks/employee/use-employee-roles
 *
 * Derives the current employee's authorisation roles from the user's
 * employee cache rather than from JWT / session data.
 */

'use client';

import { useCurrentUserEmployee } from './use-employee';
import { OrgRole } from '../../types/employee';

/**
 * Returns the current employee's organisation-scope roles.
 *
 * Composes {@link useCurrentUserEmployee} — no own query. Roles are sourced
 * from `Employee.orgRoles` so RBAC checks reflect the active-organization
 * profile, not the user's identity claims.
 *
 * @returns `{ orgRoles, isLoading, error, employee }` — `orgRoles` is empty
 *   while loading or when the user is not scoped to an organization.
 */
export function useEmployeeRoles() {
  const { data: employee, isLoading, error } = useCurrentUserEmployee();

  return {
    orgRoles: (employee?.orgRoles ?? []) as OrgRole[],
    isLoading,
    error,
    employee,
  };
}
