/**
 * @module organization-create
 *
 * Request shape and serializer for creating a new organization.
 */

/**
 * Payload for creating a new organization.
 */
export interface CreateOrganizationRequest {
  /** Display name for the organization. */
  organizationName: string;
  /** Physical address. */
  organizationAddress: string;
  /** Contact email. */
  organizationEmail: string;
  /** Contact phone number. */
  organizationPhone: string;
  /** Optional public website URL. */
  organizationWebsite?: string;
  /**
   * Not sent. `OrganizationCreationDto` has no creator, because the server
   * takes the owner from the subject claim of the caller's access token.
   * Honouring a body value would let a caller name someone else as the
   * owner of an organization they just created, so this is one to keep off
   * the wire rather than add to the DTO.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  creatorId?: number;
  /** Whether the organization should be active on creation. Defaults to `true` when omitted. */
  isActive?: boolean;
}

/**
 * Serializes a {@link CreateOrganizationRequest} for transmission to the backend.
 *
 * Optional fields are omitted from the payload when `undefined`.
 * `creatorId` is deliberately left out: the server resolves the owner
 * from the caller's token.
 *
 * @param dto - The creation request to serialize.
 * @returns A plain object matching the backend's request body shape.
 */
export function createOrganizationToJson(
  dto: CreateOrganizationRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    organizationName: dto.organizationName,
    organizationAddress: dto.organizationAddress,
    organizationEmail: dto.organizationEmail,
    organizationPhone: dto.organizationPhone,
  };
  if (dto.organizationWebsite !== undefined)
    payload.organizationWebsite = dto.organizationWebsite;
  if (dto.isActive !== undefined) payload.isActive = dto.isActive;
  return payload;
}
