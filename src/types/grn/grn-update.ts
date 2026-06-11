/**
 * @module grn-update
 *
 * Request payload and serializer for updating an existing
 * {@link GoodsReceivedNote} (`PATCH /grns/web`). The surrogate `id`
 * travels in the request body, not as a path parameter. Only header
 * fields are mutable; line items cannot be edited via this endpoint.
 */

/**
 * Partial update payload for a {@link GoodsReceivedNote}. Only fields
 * explicitly set in the payload are applied server-side.
 */
export interface UpdateGrnRequest {
  /** Surrogate ID of the GRN to update. Carried in the request body. */
  id: number;

  /** New ISO 8601 receipt date. */
  receivedOn?: string;

  /** Reassign the receipt to a different recording employee. */
  receivedByEmployeeId?: number;

  /** Reassign the receipt to a different storage location. */
  storageLocationId?: number;

  /** Replacement delivery challan number. */
  deliveryChallanNumber?: string;

  /** Replacement vendor invoice number. */
  invoiceNumber?: string;

  /** Replacement vendor invoice amount. */
  invoiceAmount?: number;
}

/**
 * Serializes an {@link UpdateGrnRequest} into the backend's expected
 * request body. `id` is always emitted; every other field is included
 * only when explicitly set (omitted when `undefined`).
 *
 * @param dto - The domain update to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updateGrnToJson(
  dto: UpdateGrnRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = { id: dto.id };
  if (dto.receivedOn !== undefined) payload.receivedOn = dto.receivedOn;
  if (dto.receivedByEmployeeId !== undefined)
    payload.receivedByEmployeeId = dto.receivedByEmployeeId;
  if (dto.storageLocationId !== undefined)
    payload.storageLocationId = dto.storageLocationId;
  if (dto.deliveryChallanNumber !== undefined)
    payload.deliveryChallanNumber = dto.deliveryChallanNumber;
  if (dto.invoiceNumber !== undefined)
    payload.invoiceNumber = dto.invoiceNumber;
  if (dto.invoiceAmount !== undefined)
    payload.invoiceAmount = dto.invoiceAmount;
  return payload;
}
