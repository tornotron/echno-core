/**
 * @module grn-create
 *
 * Request payload and serializer for creating a new
 * {@link GoodsReceivedNote}. Line items are embedded inline via
 * {@link CreateGrnItemRequest}; the server creates the parent GRN and
 * its items in one round-trip and posts the corresponding stock
 * increments + inventory-transaction ledger entries as a side-effect.
 */
import { CreateGrnItemRequest } from './grn-item-create';

/**
 * Inputs required to create a new {@link GoodsReceivedNote} together
 * with its line items.
 */
export interface CreateGrnRequest {
  /**
   * Not sent, and not yours to choose. The server allocates the GRN
   * number atomically per organisation, document type and year, on every
   * create, whatever the payload says. A value passed here was discarded
   * and the record came back carrying a different one.
   *
   * Read the allocated number off the created {@link GoodsReceivedNote} in the response.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  grnNumber?: string;

  /** ISO 8601 date the goods were received on site. */
  receivedOn: string;

  /** Surrogate ID of the {@link Employee} recording the receipt. */
  receivedByEmployeeId: number;

  /** Surrogate ID of the {@link Vendor} the goods were received from. */
  vendorId: number;

  /** Surrogate ID of the source {@link PurchaseOrder}, if any. */
  purchaseOrderId?: number;

  /** Surrogate ID of the project the receipt is allocated to. */
  projectId?: number;

  /** Surrogate ID of the storage location the goods were received at. */
  storageLocationId?: number;

  /** Vendor's delivery challan / dispatch note number. */
  deliveryChallanNumber?: string;

  /** Vendor invoice number tied to the receipt. */
  invoiceNumber?: string;

  /** Vendor invoice amount tied to the receipt. */
  invoiceAmount?: number;

  /**
   * Acknowledges in advance that this receipt may take a material past the
   * quantity its purchase order asked for.
   *
   * Left unset, the backend refuses such a line with a 400 naming the order,
   * the quantity ordered, the quantity already received against it and the
   * quantity this note offers, which is enough for somebody to recognise a
   * mistyped digit. Set, the excess is recorded and the created note comes
   * back with {@link GoodsReceivedNote.overReceiptAcknowledged} true.
   *
   * It is not a validation switch to leave on. A supplier who delivers 105
   * bags against an order for 100 has left 105 bags on the site whether the
   * system likes it or not, and a receipt that cannot be filed puts them
   * outside the stock ledger; the flag is how that delivery is admitted, by
   * somebody who looked at the figures and meant it.
   */
  allowOverReceipt?: boolean;

  /** Line items to create alongside the GRN. */
  items: CreateGrnItemRequest[];
}

/**
 * Serializes a {@link CreateGrnRequest} into the backend's expected
 * request body. Optional fields are omitted from the payload when
 * `undefined` (rather than sent as `undefined`); item-level optional
 * fields follow the same omit-when-absent rule. `grnNumber` is omitted
 * always: the server allocates it.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createGrnToJson(
  dto: CreateGrnRequest
): Record<string, unknown> {
  return {
    receivedOn: dto.receivedOn,
    receivedByEmployeeId: dto.receivedByEmployeeId,
    vendorId: dto.vendorId,
    ...(dto.purchaseOrderId !== undefined && {
      purchaseOrderId: dto.purchaseOrderId,
    }),
    ...(dto.projectId !== undefined && { projectId: dto.projectId }),
    ...(dto.storageLocationId !== undefined && {
      storageLocationId: dto.storageLocationId,
    }),
    ...(dto.deliveryChallanNumber !== undefined && {
      deliveryChallanNumber: dto.deliveryChallanNumber,
    }),
    ...(dto.invoiceNumber !== undefined && {
      invoiceNumber: dto.invoiceNumber,
    }),
    ...(dto.invoiceAmount !== undefined && {
      invoiceAmount: dto.invoiceAmount,
    }),
    ...(dto.allowOverReceipt !== undefined && {
      allowOverReceipt: dto.allowOverReceipt,
    }),
    items: dto.items.map((item: CreateGrnItemRequest) => ({
      materialId: item.materialId,
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      ...(item.unitCost !== undefined && { unitCost: item.unitCost }),
    })),
  };
}

export { type CreateGrnItemRequest } from './grn-item-create';
