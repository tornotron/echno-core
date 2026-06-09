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
   * Generate a new project invite code.
   *
   * POST /api/v1/project/web/invite-codes
   */
  async generateCode(dto: GenerateInviteCodeRequest): Promise<Invitation> {
    const data = await api.post<ApiResponse>(
      '/api/v1/project/web/invite-codes',
      generateInviteCodeToJson(dto)
    );
    return safeParseInvitation(data);
  },

  /**
   * Fetch all invite codes for a project.
   *
   * GET /api/v1/project/web/invite-codes?projectId={projectId}
   */
  async getByProject(projectId: number): Promise<Invitation[]> {
    const data = await api.get<ApiResponse[]>(
      `/api/v1/project/web/invite-codes?projectId=${projectId}`
    );
    return safeParseInvitations(data);
  },

  /**
   * Fetch a single invite code by its numeric id.
   *
   * GET /api/v1/project/web/invite-codes/{id}
   */
  async getById(id: number): Promise<Invitation> {
    const data = await api.get<ApiResponse>(
      `/api/v1/project/web/invite-codes/${id}`
    );
    return safeParseInvitation(data);
  },

  /**
   * Delete an invite code.
   *
   * DELETE /api/v1/project/web/invite-codes/{id}
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/project/web/invite-codes/${id}`);
  },
};
