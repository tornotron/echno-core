/**
 * @module purchase-order-item
 *
 * Domain types and parser for a line item on a {@link PurchaseOrder}.
 * Exposes two interfaces:
 *
 * - {@link PurchaseOrderItem} — a server-resolved line item, returned as
 *   part of `PurchaseOrder.items` or directly via
 *   `GET /purchase-order-items/{id}`.
 * - {@link InlinePurchaseOrderItemInput} — the embedded shape used when
 *   creating items inline as part of a new PO payload (see
 *   {@link CreatePurchaseOrderRequest}).
 */
import { parsePositiveInt } from '../../lib/utils/parse-id';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * A single line item on a {@link PurchaseOrder}. `materialName` is
 * denormalised from `materialId` for display; `receivedQuantity` defaults
 * to `0` until receipts are recorded against the line.
 */
export interface PurchaseOrderItem {
  /** Surrogate primary key. */
  id: number;

  /** Surrogate ID of the {@link Material} being purchased. */
  materialId: number;

  /** Display name of the material (denormalised from `materialId`). */
  materialName: string;

  /**
   * Surrogate ID of the originating indent line, when this PO was created
   * from an indent. Absent for ad-hoc purchases.
   */
  indentItemId?: number;

  /** Quantity ordered from the vendor, in the material's unit. */
  orderedQuantity: number;

  /**
   * Quantity already received against this line. Starts at `0`; advances
   * as receipts are recorded server-side.
   */
  receivedQuantity: number;

  /** Per-unit price agreed with the vendor. */
  unitPrice?: number;

  /** Line total (`orderedQuantity * unitPrice`) computed server-side. */
  totalPrice?: number;

  /** Free-form notes attached to the line item. */
  remarks?: string;
}

/**
 * Embedded line-item shape accepted by
 * {@link CreatePurchaseOrderRequest.items}. No `id` or `receivedQuantity`
 * — those are assigned server-side when the parent PO is created.
 */
export interface InlinePurchaseOrderItemInput {
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
 * Parses a raw line-item payload into a typed {@link PurchaseOrderItem}.
 * `materialName` defaults to `''` when absent; `receivedQuantity` defaults
 * to `0`.
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link PurchaseOrderItem}.
 * @throws {TypeError} When `raw.id` is missing or non-positive (propagated
 *   from {@link parsePositiveInt}).
 */
export function parsePurchaseOrderItem(raw: Raw): PurchaseOrderItem {
  return {
    id: parsePositiveInt(raw.id, 'parsePurchaseOrderItem.id'),
    materialId: raw.materialId,
    materialName: raw.materialName ?? '',
    indentItemId: raw.indentItemId ?? undefined,
    orderedQuantity: raw.orderedQuantity,
    receivedQuantity: raw.receivedQuantity ?? 0,
    unitPrice: raw.unitPrice ?? undefined,
    totalPrice: raw.totalPrice ?? undefined,
    remarks: raw.remarks ?? undefined,
  };
}
