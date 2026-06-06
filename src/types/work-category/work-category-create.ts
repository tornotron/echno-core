export interface CreateWorkCategoryRequest {
  name: string;
  description?: string;
  icon?: string;
}

export function createWorkCategoryToJson(
  dto: CreateWorkCategoryRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: dto.name };
  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.icon !== undefined) payload.icon = dto.icon;
  return payload;
}
