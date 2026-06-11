/**
 * @module wbs-element-update
 *
 * Request payload and serializer for updating an existing WBS
 * element. `name` is required; every other field is optional and
 * only emitted in the payload when explicitly set.
 *
 * Note: this payload cannot reparent an element — `parentElementId`
 * is intentionally absent. Reparenting is a structural operation that
 * goes through the dedicated move endpoint
 * (see {@link MoveWbsElementRequest} and {@link useMoveWbsElement}).
 */

/**
 * Partial update payload for a {@link WbsElement}.
 */
export interface UpdateWbsElementRequest {
  /** Replacement element name. Always emitted. */
  name: string;

  /** Replacement project-relative code. */
  code?: string;

  /** Replacement long description. */
  description?: string;

  /** Replacement planned start date (serialized as ISO 8601). */
  plannedStartDate?: Date;

  /** Replacement planned end date (serialized as ISO 8601). */
  plannedEndDate?: Date;

  /** Replacement lifecycle state (free-form string per backend convention). */
  status?: string;

  /** Replacement progress percentage (0-100). */
  progress?: number;

  /** Replacement allocated budget. */
  allocatedBudget?: number;

  /** Replacement priority tag (free-form string per backend convention). */
  priority?: string;
}

/**
 * Serializes an {@link UpdateWbsElementRequest} into the backend's
 * expected request body. `name` is always emitted; every other field
 * is included only when explicitly set; dates are converted to ISO
 * 8601 strings.
 *
 * @param dto - The domain update to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updateWbsElementToJson(
  dto: UpdateWbsElementRequest
): Record<string, unknown> {
  return {
    name: dto.name,
    ...(dto.code !== undefined && { code: dto.code }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.plannedStartDate !== undefined && {
      plannedStartDate: dto.plannedStartDate.toISOString(),
    }),
    ...(dto.plannedEndDate !== undefined && {
      plannedEndDate: dto.plannedEndDate.toISOString(),
    }),
    ...(dto.status !== undefined && { status: dto.status }),
    ...(dto.progress !== undefined && { progress: dto.progress }),
    ...(dto.allocatedBudget !== undefined && {
      allocatedBudget: dto.allocatedBudget,
    }),
    ...(dto.priority !== undefined && { priority: dto.priority }),
  };
}
