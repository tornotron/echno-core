/**
 * @module access-service
 *
 * Typed client for reading the access matrix: the signed-in member's own
 * access (echno-backend `CurrentUserAccessControllerWeb`) and what the
 * Roles & Permissions screen reads (`AccessAdminControllerWeb`).
 *
 * | Method | Path | Response |
 * | --- | --- | --- |
 * | GET | `/access/web/current-user-access` | `CurrentUserAccessDto` |
 * | GET | `/access/web/catalog` | `AccessCatalogDto` |
 * | GET | `/access/web/roles` | `AccessRoleDto[]` |
 * | GET | `/access/web/users` | `AccessUserDto[]` |
 *
 * Reads only. The backend serves these once the access endpoints are built;
 * until then each call answers as a path the server does not route. The
 * screen's writes arrive with the endpoints that take them.
 *
 * All functions throw {@link ApiError} on non-2xx responses or parse failures.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { CurrentUserAccess, parseCurrentUserAccess } from '../types/access/current-user-access';
import {
  AccessCatalog,
  AccessRole,
  AccessUser,
  parseAccessCatalog,
  parseAccessRole,
  parseAccessUser,
} from '../types/access/access-admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/** Parses with `parse`, turning a failure into a 422 {@link ApiError} named after `what`. */
function safeParse<T>(parse: (json: unknown) => T, data: ApiResponse, what: string): T {
  try {
    return parse(data);
  } catch (error) {
    logger.error(`Failed to parse ${what}:`, error);
    throw new ApiError(`Failed to process ${what}. Please try again.`, 422);
  }
}

function safeParseList<T>(parse: (json: unknown) => T, data: ApiResponse, what: string): T[] {
  if (!Array.isArray(data)) {
    logger.error(`Expected a list of ${what}, got:`, data);
    throw new ApiError(`Failed to process ${what}. Please try again.`, 422);
  }
  return data.map((item) => safeParse(parse, item, what));
}

export const accessService = {
  /**
   * Fetches what the signed-in member may do in their current organization.
   *
   * `GET /access/web/current-user-access` → `CurrentUserAccessDto`
   *
   * @returns The caller's {@link CurrentUserAccess}.
   * @throws {ApiError} 403 if the caller is not an active member of the
   *   current organization; on other non-2xx responses or parse failure.
   */
  async getCurrentUserAccess(): Promise<CurrentUserAccess> {
    const data = await api.get<ApiResponse>('/access/web/current-user-access');
    return safeParse(parseCurrentUserAccess, data, 'access data');
  },

  /**
   * Fetches the sections, areas and actions the matrix shows, and the scopes
   * a grant can take.
   *
   * `GET /access/web/catalog` → `AccessCatalogDto`
   *
   * @throws {ApiError} 403 if the caller may not view roles and permissions.
   */
  async getCatalog(): Promise<AccessCatalog> {
    const data = await api.get<ApiResponse>('/access/web/catalog');
    return safeParse(parseAccessCatalog, data, 'access catalog');
  },

  /**
   * Fetches the organization's roles, the baseline role first.
   *
   * `GET /access/web/roles` → `AccessRoleDto[]`
   */
  async getRoles(): Promise<AccessRole[]> {
    const data = await api.get<ApiResponse>('/access/web/roles');
    return safeParseList(parseAccessRole, data, 'roles');
  },

  /**
   * Fetches every employee with the roles and grants given to them directly.
   *
   * `GET /access/web/users` → `AccessUserDto[]`
   */
  async getUsers(): Promise<AccessUser[]> {
    const data = await api.get<ApiResponse>('/access/web/users');
    return safeParseList(parseAccessUser, data, "people's access");
  },
};
