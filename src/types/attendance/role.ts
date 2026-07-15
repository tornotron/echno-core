/**
 * types/attendance/role.ts
 *
 * Frontend role abstraction for attendance management. Rolls up backend
 * `OrgRole` values (PROJECT_MANAGER, SITE_MANAGER, HR_MANAGER, etc.) into a
 * three-tier hierarchy used by the attendance UI for dashboard switching and
 * permission gating.
 *
 * The enum + context interface live here (not in the consuming hook) so
 * pages and feature components can import them without pulling in the
 * `useAttendanceRole` runtime.
 *
 * `resolveAttendanceRole` is the pure role-resolution policy (Admin >
 * Manager > Employee). It lives in echno-core so every platform shares one
 * permission ladder; the platform-specific auth binding (next-auth on web,
 * native auth on mobile) supplies the flags. Authentication itself does NOT
 * live in echno-core.
 */

export enum AttendanceRole {
  EMPLOYEE = 'employee',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

export interface AttendanceRoleContext {
  /** Primary role for the user. */
  role: AttendanceRole;

  /** Quick boolean checks. */
  isEmployee: boolean;
  isManager: boolean;
  isAdmin: boolean;

  /** Available roles for this user (used for dashboard switching). */
  availableRoles: AttendanceRole[];

  /** Permission flags. */
  canApprove: boolean;
  canManageSettings: boolean;
  canViewAllProjects: boolean;
  canViewTeamAttendance: boolean;
  canViewOwnAttendance: boolean;
  canMarkAttendance: boolean;

  /** Loading state from the underlying authorization hook. */
  isLoading: boolean;
}

/**
 * Role flags supplied by the platform's authorization layer. Each platform
 * resolves these from its own auth source (web: next-auth session +
 * employee org roles; mobile: native auth) and passes them to
 * `resolveAttendanceRole`.
 */
export interface AttendanceRoleFlags {
  isAdmin: boolean;
  isManagerOrAbove: boolean;
  isLoading: boolean;
}

/**
 * Pure role-resolution policy for attendance management.
 *
 * Maps the caller's authorization flags onto the effective attendance role
 * and its permission set. Role priority: Admin > Manager > Employee.
 *
 * This is intentionally framework-agnostic (no React, no auth library) so it
 * can be unit-tested in isolation and reused across web and native clients.
 * Wrap it in a platform hook to supply the flags (see echno-web's
 * `useAttendanceRole`).
 */
export function resolveAttendanceRole({
  isAdmin,
  isManagerOrAbove,
  isLoading,
}: AttendanceRoleFlags): AttendanceRoleContext {
  const availableRoles: AttendanceRole[] = [AttendanceRole.EMPLOYEE];

  if (isManagerOrAbove) availableRoles.push(AttendanceRole.MANAGER);
  if (isAdmin) availableRoles.push(AttendanceRole.ADMIN);

  // Priority 1: Admin
  if (isAdmin) {
    return {
      role: AttendanceRole.ADMIN,
      isEmployee: true,
      isManager: true,
      isAdmin: true,
      availableRoles,
      canApprove: true,
      canManageSettings: true,
      canViewAllProjects: true,
      canViewTeamAttendance: true,
      canViewOwnAttendance: true,
      canMarkAttendance: true,
      isLoading,
    };
  }

  // Priority 2: Manager (PROJECT_MANAGER, SITE_MANAGER, HR_MANAGER)
  if (isManagerOrAbove) {
    return {
      role: AttendanceRole.MANAGER,
      isEmployee: true,
      isManager: true,
      isAdmin: false,
      availableRoles,
      canApprove: true,
      canManageSettings: false,
      canViewAllProjects: false,
      canViewTeamAttendance: true,
      canViewOwnAttendance: true,
      canMarkAttendance: true,
      isLoading,
    };
  }

  // Priority 3: Employee (default)
  return {
    role: AttendanceRole.EMPLOYEE,
    isEmployee: true,
    isManager: false,
    isAdmin: false,
    availableRoles,
    canApprove: false,
    canManageSettings: false,
    canViewAllProjects: false,
    canViewTeamAttendance: false,
    canViewOwnAttendance: true,
    canMarkAttendance: false,
    isLoading,
  };
}
