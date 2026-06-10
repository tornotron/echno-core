/**
 * @module purchase-order-update
 *
 * Request payload and serializer for updating an existing
 * {@link PurchaseOrder}.
 *
 * Unlike most update DTOs in echno-core, `id` is part of the request body
 * rather than just the URL — the backend reads it from the JSON payload.
 * {@link purchaseOrdersService.update} still places the same `id` in the
 * URL path, so both locations agree.
 */
import { PurchaseOrderStatus } from './enums';

/**
 * Patch payload for updating a {@link PurchaseOrder}. `id` is required in
 * the body; every other field is optional and only sent when set.
 *
 * Line items are updated through the
 * {@link purchaseOrderItemsService} endpoints, not via this DTO.
 */
export interface UpdatePurchaseOrderRequest {
  /** Surrogate ID of the PO to update — required in the request body. */
  id: number;

  /** New lifecycle state — see {@link PurchaseOrderStatus}. */
  status?: PurchaseOrderStatus;

  /** New project allocation. */
  projectId?: number;

  /** New expected delivery date (ISO 8601). */
  expectedDeliveryDate?: string;

  /** Updated free-form notes. */
  remarks?: string;

  /** Updated PO total. */
  totalAmount?: number;
}

/**
 * Serializes an {@link UpdatePurchaseOrderRequest} into the backend's
 * expected patch body. Every field is forwarded as-is (including the
 * required `id`); the backend treats `undefined` as "leave unchanged".
 *
 * @param dto - The patch request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updatePurchaseOrderToJson(
  dto: UpdatePurchaseOrderRequest
): Record<string, unknown> {
  return {
    id: dto.id,
    status: dto.status,
    projectId: dto.projectId,
    expectedDeliveryDate: dto.expectedDeliveryDate,
    remarks: dto.remarks,
    totalAmount: dto.totalAmount,
  };
}
