/**
 * @module organization-update
 *
 * Request shape and serializer for updating an existing organization.
 */

/**
 * Payload for partially updating an organization.
 *
 * Only fields explicitly set are included in the serialized request body.
 */
export interface UpdateOrganizationRequest {
  /** Updated display name. */
  organizationName?: string;
  /** Updated physical address. */
  organizationAddress?: string;
  /** Updated contact email. */
  organizationEmail?: string;
  /** Updated contact phone number. */
  organizationPhone?: string;
  /** Updated website URL. Pass an empty string to clear the field. */
  organizationWebsite?: string;
  /**
   * Not sent. `OrganizationUpdateFieldsDto` has no such field, and the update
   * switch names this key in its `default` branch as the one echno-core sends
   * that the endpoint cannot apply. The flag is being removed rather than wired
   * up; the argument is on the create request and on echno-core#57.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  isActive?: boolean;
}

/**
 * Serializes an {@link UpdateOrganizationRequest} for transmission to the backend.
 *
 * Only fields that are explicitly set (not `undefined`) are included in the
 * returned payload. `isActive` is deliberately left out: the endpoint has no
 * such field.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object containing only the fields to update.
 */
export function updateOrganizationToJson(
  dto: UpdateOrganizationRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (dto.organizationName !== undefined)
    payload.organizationName = dto.organizationName;
  if (dto.organizationAddress !== undefined)
    payload.organizationAddress = dto.organizationAddress;
  if (dto.organizationEmail !== undefined)
    payload.organizationEmail = dto.organizationEmail;
  if (dto.organizationPhone !== undefined)
    payload.organizationPhone = dto.organizationPhone;
  if (dto.organizationWebsite !== undefined)
    payload.organizationWebsite = dto.organizationWebsite;
  return payload;
}
