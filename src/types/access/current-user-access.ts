/**
 * @module current-user-access
 *
 * What the signed-in member may do in their current organization, as the
 * access matrix answers it (`GET /api/v1/access/web/current-user-access`,
 * echno-backend `CurrentUserAccessDto`).
 *
 * For deciding what to show only: the server checks every request on its
 * own, so hiding a button never stands in for a check there.
 */

import { z } from 'zod';

/**
 * Which records a grant covers: every record, records of projects the member
 * is assigned to, records linked to them, or only their own.
 */
export type AccessScope = 'ALL' | 'ASSIGNED_PROJECTS' | 'RELATED' | 'OWN';

const ACCESS_SCOPES: readonly AccessScope[] = ['ALL', 'ASSIGNED_PROJECTS', 'RELATED', 'OWN'];

/** The caller's access in one organization. */
export interface CurrentUserAccess {
  /** The organization the answer is for. */
  organizationId: number;
  /** The caller's employee id (their membership) in that organization. */
  employeeId: number;
  /**
   * Every permission the caller holds, keyed `<area>:<action>` (for example
   * `assets:create`), with the scopes it covers. A permission the caller
   * does not hold is absent.
   */
  grants: Record<string, AccessScope[]>;
  /**
   * For each project id, the permissions the caller holds only on that
   * project, keyed and scoped the same way. `ALL` there means every record
   * of that project. A project with nothing of its own is absent.
   */
  projectGrants: Record<number, Record<string, AccessScope[]>>;
}

const CurrentUserAccessResponseSchema = z.object({
  organizationId: z.number(),
  employeeId: z.number(),
  grants: z.record(z.string(), z.array(z.string())).nullish(),
  projectGrants: z.record(z.string(), z.record(z.string(), z.array(z.string()))).nullish(),
});

/** Keeps the scopes this client knows, and drops a permission left with none. */
function knownGrants(raw: Record<string, string[]>): Record<string, AccessScope[]> {
  const grants: Record<string, AccessScope[]> = {};
  for (const [permission, scopes] of Object.entries(raw)) {
    const known = scopes.filter((s): s is AccessScope => ACCESS_SCOPES.includes(s as AccessScope));
    if (known.length > 0) grants[permission] = known;
  }
  return grants;
}

/**
 * Parses a raw API payload into a typed {@link CurrentUserAccess}.
 *
 * A scope this client does not know is dropped, and a permission left with
 * no known scope is dropped with it, so a scope added on the server later
 * never reads as access the client cannot interpret. The same holds for each
 * project's grants, and a project left with none is dropped.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `CurrentUserAccess` domain object.
 * @throws {Error} If `organizationId` or `employeeId` is missing.
 */
export function parseCurrentUserAccess(json: unknown): CurrentUserAccess {
  const raw = CurrentUserAccessResponseSchema.parse(json);
  const projectGrants: Record<number, Record<string, AccessScope[]>> = {};
  for (const [projectId, grants] of Object.entries(raw.projectGrants ?? {})) {
    const id = Number(projectId);
    const known = knownGrants(grants);
    if (Number.isInteger(id) && Object.keys(known).length > 0) projectGrants[id] = known;
  }
  return {
    organizationId: raw.organizationId,
    employeeId: raw.employeeId,
    grants: knownGrants(raw.grants ?? {}),
    projectGrants,
  };
}

/**
 * Whether the access holds `<area>:<action>` across the organization, at any
 * scope or at the one given. A permission held only on some project does not
 * count here; ask {@link holdsPermissionOnProject} for that. An absent access
 * (still loading, or failed) holds nothing.
 *
 * @param access - The caller's access, or `undefined` while it loads.
 * @param area - An area id from the access catalog, e.g. `'assets'`.
 * @param action - `'read'`, `'create'`, `'edit'`, `'approve'`, `'delete'` or a named action.
 * @param scope - Optional scope the grant must cover.
 */
export function holdsPermission(
  access: CurrentUserAccess | undefined,
  area: string,
  action: string,
  scope?: AccessScope
): boolean {
  const scopes = access?.grants[`${area}:${action}`];
  if (!scopes || scopes.length === 0) return false;
  return scope === undefined || scopes.includes(scope);
}

/**
 * Whether the access holds `<area>:<action>` on one project: across the
 * organization, or on that project alone. An absent access holds nothing.
 *
 * @param access - The caller's access, or `undefined` while it loads.
 * @param projectId - The project the record belongs to.
 * @param area - An area id from the access catalog, e.g. `'assets'`.
 * @param action - `'read'`, `'create'`, `'edit'`, `'approve'`, `'delete'` or a named action.
 * @param scope - Optional scope the grant must cover.
 */
export function holdsPermissionOnProject(
  access: CurrentUserAccess | undefined,
  projectId: number,
  area: string,
  action: string,
  scope?: AccessScope
): boolean {
  if (holdsPermission(access, area, action, scope)) return true;
  const scopes = access?.projectGrants[projectId]?.[`${area}:${action}`];
  if (!scopes || scopes.length === 0) return false;
  return scope === undefined || scopes.includes(scope);
}
