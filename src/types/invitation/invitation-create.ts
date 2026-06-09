export interface GenerateInviteCodeRequest {
  projectId: number;
  role: string;
  expiryDate?: Date;
  maxUsageCount?: number;
}

export function generateInviteCodeToJson(
  dto: GenerateInviteCodeRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    projectId: dto.projectId,
    role: dto.role,
  };
  if (dto.expiryDate !== undefined)
    payload.expiryDate = dto.expiryDate.toISOString();
  if (dto.maxUsageCount !== undefined)
    payload.maxUsageCount = dto.maxUsageCount;
  return payload;
}
