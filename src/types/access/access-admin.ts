/**
 * @module access-admin
 *
 * The access matrix as the Roles & Permissions screen reads and writes it:
 * the catalog of areas and actions, the organization's roles, and each
 * person's own roles and grants (echno-backend `AccessAdminControllerWeb`
 * and `AccessAdminWriteControllerWeb`). The screen has two tabs, Roles and
 * Users; there are no groups.
 *
 * Role ids are UUID strings; a person is keyed by their employee id. A
 * permission is `<area>:<action>`, for example `assets:create`. The reading
 * action is `read`.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/** One action of an area, and whether some backend guard checks it. */
export interface AccessAction {
  /** The part of a permission after the colon, such as `read` or `certify`. */
  action: string;
  /**
   * Whether a guard on the server checks this action. The screen offers a
   * choice only for an enforced action; the server refuses to add a grant on
   * any other (a grant already held may be sent back as it is).
   */
  enforced: boolean;
}

/** One area a grant can name, such as `assets`, with the actions it has. */
export interface AccessArea {
  /** The area's id, the part of a permission before the colon. */
  id: string;
  label: string;
  /** The heading the area sits under; one of {@link AccessCatalog.sections}. */
  section: string;
  /**
   * Every action of the area in display order: `read`, `create`, `edit`,
   * `approve`, `delete`, then any named ones (such as `certify`). Use
   * {@link AccessArea.enforcedActions} for what the screen may offer.
   */
  actions: string[];
  /** The same actions, each with whether a guard enforces it. */
  actionDetails: AccessAction[];
  /** The actions a guard enforces, in display order. */
  enforcedActions: string[];
  /**
   * Whether the area filters its records by scope. On an area that does not,
   * the server refuses every scope but `ALL`. False from a backend that does
   * not send the flag, so no narrower scope is offered that it would refuse.
   */
  scopeAware: boolean;
}

/** What the matrix shows: its sections, areas and the scopes a grant can take. */
export interface AccessCatalog {
  /** Section headings in display order. */
  sections: string[];
  areas: AccessArea[];
  /** Scopes in order from widest to narrowest, e.g. `ALL` … `OWN`. */
  scopes: string[];
}

// ---------------------------------------------------------------------------
// Grants
// ---------------------------------------------------------------------------

/** One permission held at one scope. */
export interface AccessGrant {
  /** `<area>:<action>`. */
  permission: string;
  /**
   * One of the catalog's scopes (an `AccessScope` today), kept as the server
   * sent it so a scope this client does not know is still shown.
   */
  scope: string;
  /**
   * @deprecated The backend has no locked grants; this reads as false. The
   *   rules that keep a grant in place are enforced on the server and come
   *   back as a refusal.
   */
  locked: boolean;
}

/** One permission granted to a person directly, on top of their roles. */
export interface AccessUserGrant extends AccessGrant {
  /** The project it holds on; absent when it holds across the organization. */
  projectId?: number;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** One person holding a role, on one project or across the organization. */
export interface AccessAssignment {
  employeeId: number;
  /** The project the role holds on; absent when it holds across the organization. */
  projectId?: number;
}

export interface AccessRole {
  id: string;
  /** Stable key made from the first name; never changes on rename. */
  slug: string;
  name: string;
  /** Short qualifier shown under the name, e.g. "Site Execution". */
  subtitle?: string;
  description?: string;
  /**
   * System Admin or the baseline role. Neither is renamed or deleted; System
   * Admin's grants and grantable roles are fixed, and the baseline's grants
   * change only for a holder of `access:edit-employee-role`.
   */
  system: boolean;
  /** The role every member holds without being assigned it. */
  baseline: boolean;
  /** Kept from the old roles so nobody lost access; a new organization's screen does not offer it. */
  carriedOver: boolean;
  /**
   * Stands in for an old role and holds across the organization, so it
   * cannot be given on one project yet.
   */
  organizationWideOnly: boolean;
  grants: AccessGrant[];
  /**
   * The people it is assigned to, each on a project or across the
   * organization. Empty for the baseline, which everyone holds.
   */
  assignments: AccessAssignment[];
  /** The distinct employee ids among {@link AccessRole.assignments}. */
  memberIds: number[];
  /** Roles this role's holders may assign to others. */
  grantableRoleIds: string[];
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** One role a person holds, on one project or across the organization. */
export interface AccessUserRole {
  roleId: string;
  /** The project it holds on; absent when it holds across the organization. */
  projectId?: number;
}

/** A person with what is given to them directly. The baseline role is implied. */
export interface AccessUser {
  employeeId: number;
  name: string;
  email?: string;
  designation?: string;
  /** Whether their status still gives them access. */
  active: boolean;
  /** Roles assigned to them, each on a project or across the organization. */
  roles: AccessUserRole[];
  /** The distinct role ids among {@link AccessUser.roles}. */
  roleIds: string[];
  /** Grants of their own, on top of their roles. */
  grants: AccessUserGrant[];
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * A role's name and what it says about itself (`AccessRoleRequest`). An
 * update replaces all three, so an absent subtitle or description clears it.
 */
export interface AccessRoleRequest {
  /** Unique in the organization ignoring case; at most 120 characters. */
  name: string;
  /** At most 120 characters. */
  subtitle?: string;
  /** At most 2000 characters. */
  description?: string;
}

/** One permission to grant, with the records it covers (`AccessGrantRequest`). */
export interface AccessGrantRequest {
  /** `<area>:<action>` from the catalog. */
  permission: string;
  /** `ALL`, or a narrower scope on an area the catalog marks scope aware. */
  scope: string;
}

/** One role a person should hold (`AccessUserRoleRequest`). */
export interface AccessUserRoleRequest {
  roleId: string;
  /**
   * The project it holds on; absent for across the organization. A role that
   * is {@link AccessRole.organizationWideOnly} takes no project.
   */
  projectId?: number;
}

/** A role just created, with no grants yet (`AccessRoleCreatedDto`). */
export interface AccessRoleCreated {
  id: string;
  slug: string;
}

// ---------------------------------------------------------------------------
// Rules the screen draws from
// ---------------------------------------------------------------------------

/**
 * The scopes the screen may offer for a grant on `area`: every catalog scope
 * on a scope-aware area, and only `ALL` on any other.
 */
export function offeredScopes(catalog: AccessCatalog, area: AccessArea): string[] {
  return area.scopeAware ? catalog.scopes : catalog.scopes.filter((s) => s === 'ALL');
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

const optionalText = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined);
const optionalId = z
  .number()
  .nullish()
  .transform((v) => v ?? undefined);
const flag = z
  .boolean()
  .nullish()
  .transform((v) => v ?? false);
const list = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((v) => v ?? []);

/** A bare action name reads as not enforced, so it is never offered on a guess. */
const ActionSchema = z.union([
  z.string().transform((action): AccessAction => ({ action, enforced: false })),
  z.object({ action: z.string(), enforced: flag }),
]);

const AreaSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    section: z.string(),
    actions: list(ActionSchema),
    scopeAware: flag,
  })
  .transform(
    ({ actions, ...area }): AccessArea => ({
      ...area,
      actions: actions.map((a) => a.action),
      actionDetails: actions,
      enforcedActions: actions.filter((a) => a.enforced).map((a) => a.action),
    })
  );

const CatalogSchema = z.object({
  sections: list(z.string()),
  areas: list(AreaSchema),
  scopes: list(z.string()),
});

const GrantSchema = z.object({
  permission: z.string(),
  scope: z.string(),
  locked: flag,
});

const UserGrantSchema = GrantSchema.extend({ projectId: optionalId });

const AssignmentSchema = z.object({ employeeId: z.number(), projectId: optionalId });

const RoleSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    subtitle: optionalText,
    description: optionalText,
    system: z.boolean(),
    baseline: z.boolean(),
    carriedOver: flag,
    organizationWideOnly: flag,
    grants: list(GrantSchema),
    assignments: list(AssignmentSchema),
    grantableRoleIds: list(z.string()),
  })
  .transform(
    (role): AccessRole => ({
      ...role,
      memberIds: [...new Set(role.assignments.map((a) => a.employeeId))],
    })
  );

const UserRoleSchema = z.object({ roleId: z.string(), projectId: optionalId });

const UserSchema = z
  .object({
    employeeId: z.number(),
    name: z.string(),
    email: optionalText,
    designation: optionalText,
    active: z.boolean(),
    roles: list(UserRoleSchema),
    grants: list(UserGrantSchema),
  })
  .transform(
    (user): AccessUser => ({
      ...user,
      roleIds: [...new Set(user.roles.map((r) => r.roleId))],
    })
  );

const RoleCreatedSchema = z.object({ id: z.string(), slug: z.string() });

/**
 * Parses `AccessCatalogDto`.
 *
 * @throws {Error} If an area has no id, label or section.
 */
export function parseAccessCatalog(json: unknown): AccessCatalog {
  return CatalogSchema.parse(json);
}

/**
 * Parses `AccessRoleDto`.
 *
 * @throws {Error} If an id, slug, name or flag is missing.
 */
export function parseAccessRole(json: unknown): AccessRole {
  return RoleSchema.parse(json);
}

/**
 * Parses `AccessUserDto`.
 *
 * @throws {Error} If the employee id, name or active flag is missing.
 */
export function parseAccessUser(json: unknown): AccessUser {
  return UserSchema.parse(json);
}

/**
 * Parses `AccessRoleCreatedDto`.
 *
 * @throws {Error} If the id or slug is missing.
 */
export function parseAccessRoleCreated(json: unknown): AccessRoleCreated {
  return RoleCreatedSchema.parse(json);
}
