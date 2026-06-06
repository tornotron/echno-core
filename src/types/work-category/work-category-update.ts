export interface UpdateWorkCategoryRequest {
  name?: string;
  description?: string;
  icon?: string;
}

export function updateWorkCategoryToJson(
  dto: UpdateWorkCategoryRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (dto.name !== undefined) payload.name = dto.name;
  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.icon !== undefined) payload.icon = dto.icon;
  return payload;
}
