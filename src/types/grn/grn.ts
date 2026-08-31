/**
 * @module grn
 *
 * Domain type and parser for a Goods Received Note (GRN) — the
 * acknowledgement that one or more {@link GrnItem} lines have been
 * physically received from a vendor at a storage location. Posting a
 * GRN is what increments material stock and produces an inventory
 * transaction ledger entry server-side.
 *
 * The parser normalises the backend's wire format into the canonical
 * {@link GoodsReceivedNote} shape and tolerates two `receivedBy`
 * field names (`employeeName` vs `name`) for backwards compatibility.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  backendDate,
  money,
  nullableBoolean,
  nullableString,
  numericId,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';
import { GrnItem, parseGrnItem } from './grn-item';

const GoodsReceivedNoteResponseSchema = z.object({
  id: opaque,
  grnNumber: nullableString,
  receivedOn: backendDate,
  receivedBy: z
    .object({
      id: opaque,
      employeeName: nullableString,
      name: nullableString,
    })
    .nullish(),
  vendorId: numericId,
  vendorName: nullableString,
  purchaseOrderId: optionalNumericId,
  purchaseOrderNumber: nullableString,
  projectId: optionalNumericId,
  projectName: nullableString,
  storageLocationId: optionalNumericId,
  storageLocationName: nullableString,
  deliveryChallanNumber: nullableString,
  invoiceNumber: nullableString,
  invoiceAmount: money,
  overReceiptAcknowledged: nullableBoolean,
  items: z.array(z.unknown()).nullish(),
});

/**
 * A Goods Received Note acknowledging delivery from a vendor. Carries
 * denormalised display fields (`vendorName`, `purchaseOrderNumber`,
 * `projectName`, `storageLocationName`, `receivedBy.name`) so listings
 * render without joining each related entity.
 */
export interface GoodsReceivedNote {
  /** Surrogate primary key. */
  id: number;

  /** Human-readable GRN number assigned at creation. */
  grnNumber: string;

  /** ISO 8601 date the goods were received on site. */
  receivedOn: string;

  /**
   * Employee who recorded the receipt. The backend returns the display
   * name under `receivedBy.employeeName` (or `receivedBy.name` on
   * legacy payloads); the parser maps either to `name`.
   */
  receivedBy: { id: number; name: string };

  /** Surrogate ID of the {@link Vendor} the goods were received from. */
  vendorId: number;

  /** Vendor display name (denormalised from `vendorId`). */
  vendorName: string;

  /** Surrogate ID of the source {@link PurchaseOrder}, if any. */
  purchaseOrderId?: number;

  /** PO number for display (denormalised from `purchaseOrderId`). */
  purchaseOrderNumber?: string;

  /** Surrogate ID of the project the receipt is allocated to. */
  projectId?: number;

  /** Project display name (denormalised from `projectId`). */
  projectName?: string;

  /** Surrogate ID of the storage location the goods were received at. */
  storageLocationId?: number;

  /**
   * Storage-location display name (denormalised from
   * `storageLocationId`).
   */
  storageLocationName?: string;

  /** Vendor's delivery challan / dispatch note number. */
  deliveryChallanNumber?: string;

  /** Vendor invoice number tied to the receipt. */
  invoiceNumber?: string;

  /** Vendor invoice amount tied to the receipt. */
  invoiceAmount?: number;

  /**
   * Whether somebody deliberately let this receipt take a material past the
   * quantity its purchase order asked for.
   *
   * The backend refuses an over-receipt by default, so a note carrying `true`
   * was filed a second time with `CreateGrnRequest.allowOverReceipt` set after
   * the figures had been read. It is worth showing: it is the difference
   * between a delivery that matched its order and one somebody decided to
   * accept anyway, and it is the only thing on the document that says so six
   * months on. `false` on every note filed within its order, and on every note
   * that cites no order at all.
   */
  overReceiptAcknowledged: boolean;

  /** Line items received as part of this GRN. */
  items: GrnItem[];
}

/**
 * Parses a raw GRN payload into a typed {@link GoodsReceivedNote}.
 *
 * `receivedBy.name` is sourced from `receivedBy.employeeName` first,
 * falling back to `receivedBy.name`, then to `''`. Optional fields
 * resolve to `undefined`; an absent or non-array `items` resolves to
 * `[]`.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link GoodsReceivedNote}.
 * @throws {TypeError} When `id` or `receivedBy.id` is missing or non-positive
 *   (propagated from {@link parsePositiveInt}), or `vendorId` is not a
 *   positive integer.
 */
export function parseGoodsReceivedNote(json: unknown): GoodsReceivedNote {
  const raw = GoodsReceivedNoteResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseGoodsReceivedNote.id'),
    grnNumber: raw.grnNumber ?? '',
    receivedOn: raw.receivedOn ?? '',
    receivedBy: {
      id: parsePositiveInt(
        raw.receivedBy?.id,
        'parseGoodsReceivedNote.receivedBy.id'
      ),
      name: raw.receivedBy?.employeeName ?? raw.receivedBy?.name ?? '',
    },
    vendorId: raw.vendorId,
    vendorName: raw.vendorName ?? '',
    purchaseOrderId: raw.purchaseOrderId ?? undefined,
    purchaseOrderNumber: raw.purchaseOrderNumber ?? undefined,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    storageLocationId: raw.storageLocationId ?? undefined,
    storageLocationName: raw.storageLocationName ?? undefined,
    deliveryChallanNumber: raw.deliveryChallanNumber ?? undefined,
    invoiceNumber: raw.invoiceNumber ?? undefined,
    invoiceAmount: raw.invoiceAmount ?? undefined,
    overReceiptAcknowledged: raw.overReceiptAcknowledged ?? false,
    items: Array.isArray(raw.items)
      ? raw.items.map((item) => parseGrnItem(item))
      : [],
  };
}
