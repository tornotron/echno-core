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
}

const CurrentUserAccessResponseSchema = z.object({
  organizationId: z.number(),
  employeeId: z.number(),
  grants: z.record(z.string(), z.array(z.string())).nullish(),
});

/**
 * Parses a raw API payload into a typed {@link CurrentUserAccess}.
 *
 * A scope this client does not know is dropped, and a permission left with
 * no known scope is dropped with it, so a scope added on the server later
 * never reads as access the client cannot interpret.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `CurrentUserAccess` domain object.
 * @throws {Error} If `organizationId` or `employeeId` is missing.
 */
export function parseCurrentUserAccess(json: unknown): CurrentUserAccess {
  const raw = CurrentUserAccessResponseSchema.parse(json);
  const grants: Record<string, AccessScope[]> = {};
  for (const [permission, scopes] of Object.entries(raw.grants ?? {})) {
    const known = scopes.filter((s): s is AccessScope => ACCESS_SCOPES.includes(s as AccessScope));
    if (known.length > 0) grants[permission] = known;
  }
  return { organizationId: raw.organizationId, employeeId: raw.employeeId, grants };
}

/**
 * Whether the access holds `<area>:<action>`, at any scope or at the one
 * given. An absent access (still loading, or failed) holds nothing.
 *
 * @param access - The caller's access, or `undefined` while it loads.
 * @param area - An area id from the access catalog, e.g. `'assets'`.
 * @param action - `'view'`, `'create'`, `'edit'`, `'approve'`, `'delete'` or a named action.
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
