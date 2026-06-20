import { OrgRole } from "../../types/employee";
import { useEmployees } from "../employee";

/**
 * @module use-role-management
 *
 * Read-side hook for the role-management module. Exposes
 * {@link useRoleManagement}, a derived selector over the employees cache —
 * the module has no own query namespace.
 */

/**
 * Reads the current and assignable org roles for a specific employee.
 *
 * Derives entirely from the shared employees list cache via
 * {@link useEmployees}, so no additional network request is issued when
 * employees are already loaded. `availableRoles` is every {@link OrgRole}
 * not already present on the employee.
 *
 * @param employeeId - The employee's numeric id.
 * @returns An object with `currentRoles` (the employee's assigned roles),
 *   `availableRoles` (roles not yet assigned), the resolved `employee`
 *   record (or `undefined` if not in cache), and the `isLoading` flag
 *   forwarded from the underlying employees query.
 */
export function useRoleManagement(employeeId: number) {
  const { data: employees, isLoading } = useEmployees();
  const employee = employees?.find((e) => e.id === employeeId);
  const currentRoles: OrgRole[] = employee?.orgRoles ?? [];

  const availableRoles = Object.values(OrgRole).filter(
    (role) => !currentRoles.includes(role)
  );

  return {
    currentRoles,
    availableRoles,
    employee,
    isLoading,
  };
}
