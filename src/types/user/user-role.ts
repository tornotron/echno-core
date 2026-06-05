/**
 * @module types/user/user-role
 *
 * Enumeration of organization-scope user roles plus label / parsing helpers.
 *
 * These values are the canonical strings stored on `User.roles` and
 * propagated by Keycloak. UI code that needs a human-readable form should
 * call {@link getUserRoleLabel}; payloads that arrive as untrusted strings
 * should be normalised via {@link userRoleFromString}.
 */

export enum UserRole {
  /** Top-level account owner; can perform every privileged action. */
  OWNER = 'OWNER',

  /** Co-founder tier; near-owner permissions, board-style oversight. */
  CO_FOUNDER = 'CO_FOUNDER',

  /** HR manager; people-ops privileges (invitations, leave, attendance). */
  HR_MANAGER = 'HR_MANAGER',

  /** Standard employee; access scoped to their own assignments. */
  EMPLOYEE = 'EMPLOYEE',

  /** Student-track user (internship / trainee context). */
  STUDENT = 'STUDENT',

  /** Senior leadership / executive group. */
  MANAGEMENT = 'MANAGEMENT',

  /** Platform administrator; cross-organization elevated permissions. */
  ADMINISTRATOR = 'ADMINISTRATOR',
}

const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.OWNER]: 'Owner',
  [UserRole.CO_FOUNDER]: 'Co-Founder',
  [UserRole.HR_MANAGER]: 'HR Manager',
  [UserRole.EMPLOYEE]: 'Employee',
  [UserRole.STUDENT]: 'Student',
  [UserRole.MANAGEMENT]: 'Management',
  [UserRole.ADMINISTRATOR]: 'Administrator',
};

/**
 * Returns the human-friendly label for a {@link UserRole}.
 *
 * @param role - The role to format.
 * @returns The localized label, or the enum value itself if no label is mapped.
 */
export function getUserRoleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role] ?? role;
}

/**
 * Narrows an untrusted string to a {@link UserRole} value.
 *
 * @param str - Raw input (e.g. from a query string or backend payload).
 * @returns The matching enum value, or `undefined` if `str` is not a known role.
 */
export function userRoleFromString(str: string): UserRole | undefined {
  const values = Object.values(UserRole) as string[];
  return values.includes(str) ? (str as UserRole) : undefined;
}
