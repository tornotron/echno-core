export interface CreateOrganizationRequest {
  organizationName: string;
  organizationAddress: string;
  organizationEmail: string;
  organizationPhone: string;
  organizationWebsite?: string;
  creatorId: number;
  isActive?: boolean;
}

export function createOrganizationToJson(
  dto: CreateOrganizationRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    organizationName: dto.organizationName,
    organizationAddress: dto.organizationAddress,
    organizationEmail: dto.organizationEmail,
    organizationPhone: dto.organizationPhone,
    creatorId: dto.creatorId,
  };
  if (dto.organizationWebsite !== undefined)
    payload.organizationWebsite = dto.organizationWebsite;
  if (dto.isActive !== undefined) payload.isActive = dto.isActive;
  return payload;
}
