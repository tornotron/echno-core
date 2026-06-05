/**
 * @module types/user/user-update
 *
 * Request payload type and serializer for `PATCH /user/web/{id}`.
 *
 * Every field is optional; only set fields are sent in the request body so
 * the same shape powers both a focused single-field patch (e.g. organization
 * switch) and a full profile edit.
 */

import { formatDateForBackend } from './user';

/**
 * Partial update request for the current user.
 *
 * Mirrors {@link User} but excludes server-managed fields (`id`, `email`,
 * `roles`, attachments, timestamps). All properties are optional; only
 * provided fields are forwarded by {@link updateUserToJson}.
 */
export interface UpdateUserRequest {
  /** New display name. */
  name?: string;

  /** New postal address. */
  address?: string;

  /** Updated blood group. */
  bloodGroup?: string;

  /** New phone number. */
  phone?: string;

  /** Updated gender. */
  gender?: string;

  /** New date of birth. Serialized as a date-only string. */
  dateOfBirth?: Date;

  /** New qualification. */
  qualification?: string;

  /** Updated skills list. */
  skills?: string[];

  /** Updated years of experience. */
  experience?: number;

  /** New emergency contact string. */
  emergencyContact?: string;

  /** Updated certifications list. */
  certifications?: string[];

  /**
   * New default organization. Pass `null` to clear the preference;
   * `undefined` to leave it unchanged.
   */
  defaultOrganizationId?: number | null;
}

/**
 * Serializes an {@link UpdateUserRequest} into a JSON payload for
 * `PATCH /user/web/{id}`.
 *
 * Only fields that are not `undefined` are emitted, so a partial update
 * stays partial. {@link UpdateUserRequest.dateOfBirth | dateOfBirth} is
 * formatted via {@link formatDateForBackend} so the wire format always
 * matches the backend's `YYYY-MM-DDTHH:mm:ss` expectation.
 *
 * @param dto - The partial update request to serialize.
 * @returns A plain object containing only the explicitly set fields.
 */
export function updateUserToJson(
  dto: UpdateUserRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (dto.name !== undefined) payload.name = dto.name;
  if (dto.address !== undefined) payload.address = dto.address;
  if (dto.bloodGroup !== undefined) payload.bloodGroup = dto.bloodGroup;
  if (dto.phone !== undefined) payload.phone = dto.phone;
  if (dto.gender !== undefined) payload.gender = dto.gender;
  if (dto.dateOfBirth !== undefined)
    payload.dateOfBirth = formatDateForBackend(dto.dateOfBirth);
  if (dto.qualification !== undefined)
    payload.qualification = dto.qualification;
  if (dto.skills !== undefined) payload.skills = dto.skills;
  if (dto.experience !== undefined) payload.experience = dto.experience;
  if (dto.emergencyContact !== undefined)
    payload.emergencyContact = dto.emergencyContact;
  if (dto.certifications !== undefined)
    payload.certifications = dto.certifications;
  if (dto.defaultOrganizationId !== undefined)
    payload.defaultOrganizationId = dto.defaultOrganizationId;
  return payload;
}
