/**
 * @module indent-item-update
 *
 * Request payload and serializer for updating an existing indent line
 * item. All fields are optional — only those present in the payload are
 * applied server-side.
 */

/**
 * Partial update payload for a single indent line item. Surrogate ID is
 * supplied separately as a path parameter, not in the body.
 */
export interface UpdateIndentItemRequest {
  /** Reassign the line to a different parent indent. */
  indentId?: number;

  /** Replace the {@link Material} the line refers to. */
  materialId?: number;

  /** Adjust the requested quantity. */
  requestedQuantity?: number;

  /** Adjust the ordered quantity. */
  orderedQuantity?: number;

  /** Replacement spec text. */
  additionalSpecifications?: string;

  /** Replacement free-form notes. */
  remarks?: string;
}

/**
 * Serializes an {@link UpdateIndentItemRequest} into the backend's
 * expected request body. All fields are forwarded verbatim — the backend
 * tolerates `undefined` on optional fields.
 *
 * @param dto - The domain update to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updateIndentItemToJson(
  dto: UpdateIndentItemRequest
): Record<string, unknown> {
  return {
    indentId: dto.indentId,
    materialId: dto.materialId,
    requestedQuantity: dto.requestedQuantity,
    orderedQuantity: dto.orderedQuantity,
    additionalSpecifications: dto.additionalSpecifications,
    remarks: dto.remarks,
  };
}
