/**
 * @module access-admin
 *
 * The access matrix as the Roles & Permissions screen reads it: the catalog
 * of areas and actions, the organization's roles, and each person's own
 * roles and grants (echno-backend `AccessAdminControllerWeb`).
 *
 * Role ids are UUID strings; a person is keyed by their employee id. A
 * permission is `<area>:<action>`, for example `assets:create`.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/** One area a grant can name, such as `assets`, with the actions it has. */
export interface AccessArea {
  /** The area's id, the part of a permission before the colon. */
  id: string;
  label: string;
  /** The heading the area sits under; one of {@link AccessCatalog.sections}. */
  section: string;
  /**
   * The area's actions in display order: `view`, `create`, `edit`,
   * `approve`, `delete`, then any named ones (such as `certify`).
   */
  actions: string[];
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
  /** A grant that cannot be removed, such as everyone's access to their own leave. */
  locked: boolean;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export interface AccessRole {
  id: string;
  /** Stable key made from the first name; never changes on rename. */
  slug: string;
  name: string;
  /** Short qualifier shown under the name, e.g. "Site Execution". */
  subtitle?: string;
  description?: string;
  /** One of the starting roles every organization gets; it cannot be deleted. */
  system: boolean;
  /** The role every member holds without being assigned it. */
  baseline: boolean;
  grants: AccessGrant[];
  /** Employee ids the role is assigned to directly. */
  memberIds: number[];
  /** Roles this role's holders may assign to others. */
  grantableRoleIds: string[];
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** A person with what is given to them directly. The baseline role is implied. */
export interface AccessUser {
  employeeId: number;
  name: string;
  email?: string;
  designation?: string;
  active: boolean;
  /** Roles assigned to them directly. */
  roleIds: string[];
  /** Grants of their own, on top of their roles. */
  grants: AccessGrant[];
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

const optionalText = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined);
const list = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((v) => v ?? []);

const AreaSchema = z.object({
  id: z.string(),
  label: z.string(),
  section: z.string(),
  actions: list(z.string()),
});

const CatalogSchema = z.object({
  sections: list(z.string()),
  areas: list(AreaSchema),
  scopes: list(z.string()),
});

const GrantSchema = z.object({
  permission: z.string(),
  scope: z.string(),
  locked: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
});

const RoleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  subtitle: optionalText,
  description: optionalText,
  system: z.boolean(),
  baseline: z.boolean(),
  grants: list(GrantSchema),
  memberIds: list(z.number()),
  grantableRoleIds: list(z.string()),
});


const UserSchema = z.object({
  employeeId: z.number(),
  name: z.string(),
  email: optionalText,
  designation: optionalText,
  active: z.boolean(),
  roleIds: list(z.string()),
  grants: list(GrantSchema),
});

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
