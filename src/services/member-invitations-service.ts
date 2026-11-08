/**
 * @module member-invitations-service
 *
 * Typed client for invitations by link to join the caller's organization
 * (echno-backend `InvitationControllerWeb`).
 *
 * | Method | Path | Response |
 * | --- | --- | --- |
 * | POST | `/invitations/web` | `InvitationDto` (201) |
 * | GET | `/invitations/web?pageNo&pageSize` | `InvitationDto[]`, newest first |
 * | GET | `/invitations/web/{id}` | `InvitationDto` |
 * | POST | `/invitations/web/{id}/resend` | `InvitationDto` |
 * | POST | `/invitations/web/{id}/revoke` | `InvitationDto` |
 *
 * Every endpoint needs the `system-admin` or `hr-admin` organization role.
 * Creating answers 403 when the caller may not give one of the roles or
 * invites their own address, 404 when a role or project is not in this
 * organization, and 409 when the address is already an employee here or has
 * an open invitation. Resend and revoke answer 400 for an accepted or revoked
 * invitation.
 *
 * The invite-code client in `invitation-service` stays alongside this one
 * until web has moved off it.
 *
 * All functions throw {@link ApiError} on non-2xx responses or parse failures.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  CreateMemberInvitationRequest,
  MemberInvitation,
  MemberInvitationListParams,
  createMemberInvitationToJson,
  parseMemberInvitation,
} from '../types/member-invitations/member-invitations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/invitations/web';

function safeParse(data: ApiResponse): MemberInvitation {
  try {
    return parseMemberInvitation(data);
  } catch (error) {
    logger.error('Failed to parse invitation:', error);
    throw new ApiError('Failed to process invitation data. Please try again.', 422);
  }
}

export const memberInvitationsService = {
  /**
   * Fetches one page of the organization's invitations, newest first.
   *
   * `GET /invitations/web` → `InvitationDto[]`
   *
   * @param params - Optional zero-based `pageNo` and `pageSize`; the backend
   *   defaults to the first page of ten.
   * @throws {ApiError} 422 if the response is not a list.
   */
  async list(params: MemberInvitationListParams = {}): Promise<MemberInvitation[]> {
    const query: Record<string, number> = {};
    if (params.pageNo !== undefined) query.pageNo = params.pageNo;
    if (params.pageSize !== undefined) query.pageSize = params.pageSize;
    const data = await api.get<ApiResponse>(BASE, query);
    if (!Array.isArray(data)) {
      logger.error('Expected a list of invitations, got:', data);
      throw new ApiError('Failed to process invitation data. Please try again.', 422);
    }
    return data.map(safeParse);
  },

  /**
   * Fetches one invitation.
   *
   * `GET /invitations/web/{id}` → `InvitationDto`
   *
   * @throws {ApiError} 404 if there is no such invitation in this organization.
   */
  async get(id: string): Promise<MemberInvitation> {
    return safeParse(await api.get<ApiResponse>(`${BASE}/${id}`));
  },

  /**
   * Records an invitation and has the identity provider send the link.
   *
   * `POST /invitations/web` → `InvitationDto`
   *
   * @throws {ApiError} 400, 403, 404 or 409 as described on the module.
   */
  async create(request: CreateMemberInvitationRequest): Promise<MemberInvitation> {
    return safeParse(await api.post<ApiResponse>(BASE, createMemberInvitationToJson(request)));
  },

  /**
   * Sends the same link again and keeps its expiry. An expired invitation is
   * renewed instead: a new expiry and a new link, and the old link stops
   * working.
   *
   * `POST /invitations/web/{id}/resend` → `InvitationDto`
   *
   * @throws {ApiError} 400 if the invitation was accepted or revoked.
   */
  async resend(id: string): Promise<MemberInvitation> {
    return safeParse(await api.post<ApiResponse>(`${BASE}/${id}/resend`));
  },

  /**
   * Stops the link working.
   *
   * `POST /invitations/web/{id}/revoke` → `InvitationDto`
   *
   * @throws {ApiError} 400 if the invitation was already accepted or revoked.
   */
  async revoke(id: string): Promise<MemberInvitation> {
    return safeParse(await api.post<ApiResponse>(`${BASE}/${id}/revoke`));
  },
};
