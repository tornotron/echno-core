/**
 * @module invitation-service
 *
 * Typed client for the `project-invite-code-controller` backend endpoints.
 *
 * Wraps lower-level `api` calls and converts raw JSON into strongly-typed
 * domain objects (`Invitation`) via parse-safe helpers. Parsing failures are
 * normalized into `ApiError`; network and non-2xx errors propagate from the
 * API client for callers (React Query mutation/query error handlers) to handle.
 *
 * Endpoints (organization-scoped):
 * - `POST /invitation/web/generateCode/organizationId/{organizationId}`
 * - `POST /invitation/web/validate/userId/{userId}`
 * - `GET  /invitation/web/organizationId/{organizationId}`
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { Invitation, parseInvitation } from '../types/invitation/invitation';
import {
  GenerateInviteCodeRequest,
  generateInviteCodeToJson,
} from '../types/invitation/invitation-create';
import {
  ValidateInviteCodeRequest,
  ValidateInviteCodeResponse,
} from '../types/invitation/invitation-validate';

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
   * Generates a new employee invite code for an organization.
   *
   * `POST /invitation/web/generateCode/organizationId/{organizationId}`.
   *
   * @param organizationId - Organization ID (travels in the URL path).
   * @param request - Invitation details (without organizationId/name).
   * @returns The generated {@link Invitation} with its code.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async generateCode(
    organizationId: number,
    request: GenerateInviteCodeRequest
  ): Promise<Invitation> {
    const data = await api.post<ApiResponse>(
      `/invitation/web/generateCode/organizationId/${organizationId}`,
      generateInviteCodeToJson(request)
    );
    return safeParseInvitation(data);
  },

  /**
   * Validates an invite code for a user (accepting it joins the organization).
   *
   * `POST /invitation/web/validate/userId/{userId}`. The backend returns the
   * joined organization object directly on success; a 404/400 is treated as an
   * invalid code rather than an error.
   *
   * @param userId - User ID validating (and joining with) the code.
   * @param inviteCode - The invite code to validate.
   * @returns A {@link ValidateInviteCodeResponse}.
   * @throws {ApiError} On unexpected (non-404/400) HTTP errors.
   */
  async validateCode(
    userId: number,
    inviteCode: string
  ): Promise<ValidateInviteCodeResponse> {
    const payload: ValidateInviteCodeRequest = { code: inviteCode };

    try {
      const data = await api.post<ApiResponse>(
        `/invitation/web/validate/userId/${userId}`,
        payload
      );

      return {
        valid: true,
        invitation: {
          inviteCode,
          organizationId: data.id,
          organizationName: data.organizationName,
          usedCount: 0,
          isActive: true,
          employeeDetails: {
            department: '',
            designation: '',
          },
        },
        message: 'Valid invitation code',
      };
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.isNotFound || error.status === 400)
      ) {
        return {
          valid: false,
          message: error.message || 'Invalid or expired invite code',
        };
      }
      throw error;
    }
  },

  /**
   * Fetches all invite codes for an organization.
   *
   * `GET /invitation/web/organizationId/{organizationId}`.
   *
   * @param organizationId - Organization ID to query.
   * @returns Resolved array of {@link Invitation} objects.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async getByOrganization(organizationId: number): Promise<Invitation[]> {
    const data = await api.get<ApiResponse[]>(
      `/invitation/web/organizationId/${organizationId}`
    );
    return safeParseInvitations(data);
  },
};
