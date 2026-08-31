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
  /**
   * Not sent. `OrganizationCreationDto` has no such field, and the flag it
   * would set is being removed rather than wired up: `Organization.isActive`
   * has two writers, both hardcoded `true`, and no reader anywhere. Enforcing
   * it would put a self-service lockout on the tenant behind two roles that
   * live inside the organization being locked out, recoverable only through the
   * global-admin bypass. Tenant suspension, when it is wanted, is the
   * subscription record rather than a checkbox. See echno-core#57.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  isActive?: boolean;
}

/**
 * Serializes a {@link CreateOrganizationRequest} for transmission to the backend.
 *
 * Optional fields are omitted from the payload when `undefined`.
 * `creatorId` and `isActive` are deliberately left out: the server resolves the
 * owner from the caller's token, and the creation DTO has no active flag.
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
  return payload;
}
