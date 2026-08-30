/**
 * @module purchase-order-item-update
 *
 * Request payload and serializer for updating an existing
 * {@link PurchaseOrderItem}.
 *
 * The backend takes the id in the body, not the path, and requires it:
 * `PurchaseOrderItemUpdateDto.id` is `@NotNull`.
 * {@link purchaseOrderItemsService.update} fills it in from its own `id`
 * argument, so no call site has to pass it twice.
 */

/**
 * Patch payload for updating a {@link PurchaseOrderItem}. Every field is
 * optional; `receivedQuantity` is omitted because it advances through
 * server-side receipt postings rather than direct edits.
 */
export interface UpdatePurchaseOrderItemRequest {
  /**
   * Surrogate ID of the line item, which the backend requires in the
   * body. {@link purchaseOrderItemsService.update} sets it from its own
   * argument, so a caller going through the service never passes it.
   */
  id?: number;

  /**
   * Not sent. A line belongs to the order it was raised on for its whole
   * life; the backend has no way to move one, and reassigning a parent
   * would leave both orders' totals wrong.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  purchaseOrderId?: number;

  /**
   * Change the {@link Material} the line refers to. Accepted only while
   * nothing has been received against the line: once a goods received
   * note has posted, the line is the record of what arrived.
   */
  materialId?: number;

  /** New quantity to order from the vendor. */
  orderedQuantity?: number;

  /** New per-unit price agreed with the vendor. */
  unitPrice?: number;

  /**
   * Not sent. The server recomputes the line total from the quantity and
   * the unit price on every update, and rolls it up into the order total,
   * so a value sent here would be overwritten in the same request.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  totalPrice?: number;

  /** Updated free-form notes. */
  remarks?: string;
}

/**
 * Serializes an {@link UpdatePurchaseOrderItemRequest} into the backend's
 * expected patch body. Fields the caller did not set are sent as
 * `undefined`; the backend treats them as "leave unchanged".
 *
 * @param dto - The patch request to serialize. Its `id` is required on
 *   the wire even though it is optional on the type; the service supplies
 *   it.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updatePurchaseOrderItemToJson(
  dto: UpdatePurchaseOrderItemRequest
): Record<string, unknown> {
  return {
    id: dto.id,
    materialId: dto.materialId,
    orderedQuantity: dto.orderedQuantity,
    unitPrice: dto.unitPrice,
    remarks: dto.remarks,
  };
}
