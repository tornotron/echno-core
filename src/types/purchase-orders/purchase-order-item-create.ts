/**
 * @module purchase-order-item-create
 *
 * Request payload and serializer for creating a line item against an
 * existing {@link PurchaseOrder}. Use this when adding items after the
 * parent PO has already been created; embed line items inline via
 * {@link InlinePurchaseOrderItemInput} when creating both at once.
 */

/**
 * Inputs required to create a new {@link PurchaseOrderItem} against an
 * existing PO.
 */
export interface CreatePurchaseOrderItemRequest {
  /** Surrogate ID of the parent {@link PurchaseOrder}. */
  purchaseOrderId: number;

  /** Surrogate ID of the {@link Material} being purchased. */
  materialId: number;

  /** Surrogate ID of the originating indent line, if any. */
  indentItemId?: number;

  /** Quantity to order from the vendor, in the material's unit. */
  orderedQuantity: number;

  /** Per-unit price agreed with the vendor. */
  unitPrice?: number;

  /** Line total. The server recomputes this; supply it for round-tripping. */
  totalPrice?: number;

  /** Free-form notes attached to the line item. */
  remarks?: string;
}

/**
 * Serializes a {@link CreatePurchaseOrderItemRequest} into the backend's
 * expected request body.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createPurchaseOrderItemToJson(
  dto: CreatePurchaseOrderItemRequest
): Record<string, unknown> {
  return {
    purchaseOrderId: dto.purchaseOrderId,
    materialId: dto.materialId,
    indentItemId: dto.indentItemId,
    orderedQuantity: dto.orderedQuantity,
    unitPrice: dto.unitPrice,
    totalPrice: dto.totalPrice,
    remarks: dto.remarks,
  };
}
