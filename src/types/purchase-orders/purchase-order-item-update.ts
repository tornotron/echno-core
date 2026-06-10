/**
 * @module purchase-order-item-update
 *
 * Request payload and serializer for updating an existing
 * {@link PurchaseOrderItem}.
 */

/**
 * Patch payload for updating a {@link PurchaseOrderItem}. Every field is
 * optional; `receivedQuantity` is omitted because it advances through
 * server-side receipt postings rather than direct edits.
 */
export interface UpdatePurchaseOrderItemRequest {
  /** Reassign the line to a different parent PO (rare). */
  purchaseOrderId?: number;

  /** Change the {@link Material} the line refers to. */
  materialId?: number;

  /** New quantity to order from the vendor. */
  orderedQuantity?: number;

  /** New per-unit price agreed with the vendor. */
  unitPrice?: number;

  /** New line total. The server recomputes this. */
  totalPrice?: number;

  /** Updated free-form notes. */
  remarks?: string;
}

/**
 * Serializes an {@link UpdatePurchaseOrderItemRequest} into the backend's
 * expected patch body. Fields the caller did not set are sent as
 * `undefined`; the backend treats them as "leave unchanged".
 *
 * @param dto - The patch request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updatePurchaseOrderItemToJson(
  dto: UpdatePurchaseOrderItemRequest
): Record<string, unknown> {
  return {
    purchaseOrderId: dto.purchaseOrderId,
    materialId: dto.materialId,
    orderedQuantity: dto.orderedQuantity,
    unitPrice: dto.unitPrice,
    totalPrice: dto.totalPrice,
    remarks: dto.remarks,
  };
}
