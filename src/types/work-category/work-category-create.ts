/**
 * @module types/work-category/work-category-create
 *
 * Request shape and serializer for creating a {@link WorkCategory}.
 */

/**
 * Payload accepted by the work-category create endpoint.
 *
 * Only `name` is required; optional fields are omitted from the serialized
 * payload when undefined so the backend can apply its own defaults.
 */
export interface CreateWorkCategoryRequest {
  /** Human-readable category name. */
  name: string;

  /** Optional long-form description. */
  description?: string;

  /** Optional short text token rendered in compact UI affordances. */
  icon?: string;
}

/**
 * Serializes a {@link CreateWorkCategoryRequest} for transmission to the
 * backend. Optional fields are omitted from the output when undefined.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend's expected request body shape.
 */
export function createWorkCategoryToJson(
  dto: CreateWorkCategoryRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: dto.name };
  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.icon !== undefined) payload.icon = dto.icon;
  return payload;
}
