/**
 * @module purchase-order-create
 *
 * Request payload and serializer for creating a new {@link PurchaseOrder}.
 * Line items are embedded inline via
 * {@link InlinePurchaseOrderItemInput}; the server creates the parent PO
 * and its items in one round-trip.
 */
import { PurchaseOrderStatus } from './enums';
import type { InlinePurchaseOrderItemInput } from './purchase-order-item';

/**
 * Inputs required to create a new {@link PurchaseOrder} together with its
 * line items.
 */
export interface CreatePurchaseOrderRequest {
  /** Human-readable PO number; must be unique within the organisation. */
  poNumber: string;

  /** Surrogate ID of the {@link Vendor} the PO is issued to. */
  vendorId: number;

  /** Surrogate ID of the project the PO is allocated to. */
  projectId: number;

  /** Surrogate ID of the originating indent, if applicable. */
  indentId?: number;

  /** Initial lifecycle state — typically {@link PurchaseOrderStatus.draft}. */
  status: PurchaseOrderStatus;

  /** Surrogate ID of the {@link Employee} creating the PO. */
  createdBy: number;

  /** ISO 8601 date the buyer expects delivery by. */
  expectedDeliveryDate?: string;

  /** Free-form notes attached to the PO. */
  remarks?: string;

  /** Sum of line totals (server may recompute). */
  totalAmount?: number;

  /** Line items to create alongside the PO. */
  items: InlinePurchaseOrderItemInput[];
}

/**
 * Serializes a {@link CreatePurchaseOrderRequest} into the backend's
 * expected request body. All fields are forwarded verbatim — the backend
 * tolerates `undefined` on optional fields.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createPurchaseOrderToJson(
  dto: CreatePurchaseOrderRequest
): Record<string, unknown> {
  return {
    poNumber: dto.poNumber,
    vendorId: dto.vendorId,
    projectId: dto.projectId,
    indentId: dto.indentId,
    status: dto.status,
    createdBy: dto.createdBy,
    expectedDeliveryDate: dto.expectedDeliveryDate,
    remarks: dto.remarks,
    totalAmount: dto.totalAmount,
    items: dto.items,
  };
}
