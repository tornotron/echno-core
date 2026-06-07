export interface UpdateOrganizationRequest {
  organizationName?: string;
  organizationAddress?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  organizationWebsite?: string;
  isActive?: boolean;
}

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
  if (dto.isActive !== undefined) payload.isActive = dto.isActive;
  return payload;
}
