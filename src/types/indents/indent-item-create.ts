/**
 * @module indent-item-create
 *
 * Request payload and serializer for creating an indent line item — used
 * both as the standalone `POST /indent-items/web` body and as the
 * embedded shape on {@link CreateIndentRequest.items}. When embedded
 * under an indent create, `indentId` is omitted (the server assigns it
 * from the parent).
 */

/**
 * Inputs required to create a single indent line item.
 */
export interface CreateIndentItemRequest {
  /**
   * Surrogate ID of the parent indent. Required when creating standalone
   * via `POST /indent-items/web`; omitted when nested under a
   * {@link CreateIndentRequest}.
   */
  indentId?: number;

  /** Surrogate ID of the {@link Material} being requested. */
  materialId: number;

  /** Quantity requested, in the material's unit. */
  requestedQuantity: number;

  /** Quantity ultimately placed on a purchase order (typically set later). */
  orderedQuantity?: number;

  /** Free-form spec text supplementing the material (e.g. grade, finish). */
  additionalSpecifications?: string;

  /** Free-form notes attached to the line item. */
  remarks?: string;
}

/**
 * Serializes a {@link CreateIndentItemRequest} into the backend's
 * expected request body. All fields are forwarded verbatim — the backend
 * tolerates `undefined` on optional fields.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createIndentItemToJson(
  dto: CreateIndentItemRequest
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
