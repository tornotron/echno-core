/**
 * @module permissions
 *
 * Utility functions for client-side role checks.
 *
 * These helpers complement backend RBAC enforcement — use them to
 * conditionally render UI elements or guard navigation. Authoritative
 * permission decisions are always enforced server-side.
 */

/**
 * Returns `true` if `userRoles` contains at least one of the `required` roles.
 *
 * @param userRoles - The roles assigned to the current user.
 * @param required - A single role name or an array of role names (OR logic).
 * @returns `true` when at least one required role is present.
 */
export function hasRole(
  userRoles: string[],
  required: string | string[]
): boolean {
  const requiredRoles = Array.isArray(required) ? required : [required];
  return requiredRoles.some((r) => userRoles.includes(r));
}

/**
 * Returns `true` only if `userRoles` contains every role in `required`.
 *
 * @param userRoles - The roles assigned to the current user.
 * @param required - Array of role names that must all be present (AND logic).
 * @returns `true` when every required role is found.
 */
export function hasAllRoles(userRoles: string[], required: string[]): boolean {
  return required.every((r) => userRoles.includes(r));
}
