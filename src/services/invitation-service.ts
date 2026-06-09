/**
 * @module invitation-service
 *
 * Typed client for invitation (project invite code) backend endpoints.
 *
 * All methods currently route to legacy `/api/v1/project/web/invite-codes/*`
 * paths that no longer exist on the backend. The live spec exposes invitation
 * endpoints under `/api/v1/invitation/web/...`. An `integrate-module` pass is
 * required to realign service paths before any method will succeed in
 * production. See the module-level FIXME in `use-invitation-mutations.ts` for
 * the full remediation plan.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { Invitation, parseInvitation } from '../types/invitation/invitation';
import {
  GenerateInviteCodeRequest,
  generateInviteCodeToJson,
} from '../types/invitation/invitation-create';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseInvitation(data: ApiResponse): Invitation {
  try {
    return parseInvitation(data);
  } catch (error) {
    logger.error('Failed to parse invitation data:', error);
    throw new ApiError(
      'Failed to process invitation data. Please try again.',
      422
    );
  }
}

function safeParseInvitations(data: ApiResponse[]): Invitation[] {
  if (!Array.isArray(data)) {
    return [];
  }
  try {
    return data.map((item) => parseInvitation(item));
  } catch (error) {
    logger.error('Failed to parse invitations data:', error);
    throw new ApiError(
      'Failed to process invitations data. Please try again.',
      422
    );
  }
}

export const invitationService = {
  /**
   * Generates a new project invite code.
   *
   * `POST /api/v1/project/web/invite-codes` — path is stale; the live spec
   * endpoint is `POST /invitation/web/generateCode/organizationId/{organizationId}`.
   *
   * @param dto - Invite code generation parameters.
   * @returns The created {@link Invitation}.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async generateCode(dto: GenerateInviteCodeRequest): Promise<Invitation> {
    const data = await api.post<ApiResponse>(
      '/api/v1/project/web/invite-codes',
      generateInviteCodeToJson(dto)
    );
    return safeParseInvitation(data);
  },

  /**
   * Fetches all invite codes for a project (or organization per spec).
   *
   * `GET /api/v1/project/web/invite-codes?projectId={projectId}` — path is
   * stale; the live spec endpoint is
   * `GET /invitation/web/organizationId/{organizationId}`.
   *
   * @param projectId - ID of the project (effectively the organization) to query.
   * @returns Resolved array of {@link Invitation} objects.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async getByProject(projectId: number): Promise<Invitation[]> {
    const data = await api.get<ApiResponse[]>(
      `/api/v1/project/web/invite-codes?projectId=${projectId}`
    );
    return safeParseInvitations(data);
  },

  /**
   * Fetches a single invite code by its numeric ID.
   *
   * `GET /api/v1/project/web/invite-codes/{id}` — path is stale and has no
   * equivalent in the live spec. The backend exposes no GET-by-id endpoint for
   * invite codes; this method will 404 in production.
   *
   * @param id - Surrogate ID of the invite code.
   * @returns The resolved {@link Invitation}.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async getById(id: number): Promise<Invitation> {
    const data = await api.get<ApiResponse>(
      `/api/v1/project/web/invite-codes/${id}`
    );
    return safeParseInvitation(data);
  },

  /**
   * Deletes an invite code by ID.
   *
   * `DELETE /api/v1/project/web/invite-codes/{id}` — path is stale; the
   * backend has no DELETE endpoint for invite codes.
   *
   * @param id - Surrogate ID of the invite code to delete.
   * @throws {ApiError} On non-2xx HTTP responses.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/project/web/invite-codes/${id}`);
  },
};
