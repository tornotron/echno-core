/**
 * @module types/work-category/work-category-update
 *
 * Request shape and serializer for updating a {@link WorkCategory}.
 */

/**
 * Partial-update payload for a work category. Every field is optional;
 * only the fields the caller sets are sent to the backend.
 */
export interface UpdateWorkCategoryRequest {
  /** New category name, if changing. */
  name?: string;

  /** New description, if changing. */
  description?: string;

  /** New icon token, if changing. */
  icon?: string;
}

/**
 * Serializes an {@link UpdateWorkCategoryRequest} for transmission to the
 * backend. Undefined fields are omitted so the backend interprets the
 * payload as a partial update.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object containing only the fields the caller set.
 */
export function updateWorkCategoryToJson(
  dto: UpdateWorkCategoryRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (dto.name !== undefined) payload.name = dto.name;
  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.icon !== undefined) payload.icon = dto.icon;
  return payload;
}
