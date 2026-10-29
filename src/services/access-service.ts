/**
 * @module access-service
 *
 * Typed client for the access matrix's endpoints for the signed-in member
 * (echno-backend `CurrentUserAccessControllerWeb`).
 *
 * Endpoint audit (echno-backend `docs/openapi.json`; not yet on the live spec,
 * since the access work deploys only once the migration is complete):
 *
 * | Method | Path | Response | Classification |
 * | --- | --- | --- | --- |
 * | GET | `/access/web/current-user-access` | `CurrentUserAccessDto` | full (read) |
 *
 * All functions throw {@link ApiError} on non-2xx responses or parse failures.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { CurrentUserAccess, parseCurrentUserAccess } from '../types/access/current-user-access';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseCurrentUserAccess(data: ApiResponse): CurrentUserAccess {
  try {
    return parseCurrentUserAccess(data);
  } catch (error) {
    logger.error('Failed to parse current user access:', error);
    throw new ApiError('Failed to process access data. Please try again.', 422);
  }
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
    return safeParseCurrentUserAccess(data);
  },
};
