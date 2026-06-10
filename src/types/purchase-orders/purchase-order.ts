/**
 * @module purchase-order
 *
 * Domain type and parser for a purchase order — a vendor purchase commit
 * with one or more line items ({@link PurchaseOrderItem}). The parser
 * normalises the backend's wire format into the canonical
 * {@link PurchaseOrder} shape and tolerates two `createdBy` shapes
 * (string display name OR `{ id, employeeName }` object) for backwards
 * compatibility with older payloads.
 */
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { PurchaseOrderStatus } from './enums';
import type { PurchaseOrderItem } from './purchase-order-item';
import { parsePurchaseOrderItem } from './purchase-order-item';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const VALID_PO_STATUSES = new Set<string>(Object.values(PurchaseOrderStatus));

/**
 * A purchase order issued to a vendor. Carries denormalised display
 * fields (`vendorName`, `indentNumber`, `projectName`) so listings render
 * without joining each related entity.
 */
export interface PurchaseOrder {
  /** Surrogate primary key. */
  id: number;

  /** Human-readable PO number assigned at creation. */
  poNumber: string;

  /** Surrogate ID of the {@link Vendor} the PO is issued to. */
  vendorId: number;

  /** Vendor display name (denormalised from `vendorId`). */
  vendorName: string;

  /** Surrogate ID of the originating indent, if any. */
  indentId?: number;

  /** Indent number for display (denormalised from `indentId`). */
  indentNumber?: string;

  /** Surrogate ID of the project the PO is allocated to. */
  projectId?: number;

  /** Project display name (denormalised from `projectId`). */
  projectName?: string;

  /** Lifecycle state — see {@link PurchaseOrderStatus}. */
  status: PurchaseOrderStatus;

  /** ISO 8601 timestamp the PO was created. */
  createdAt: string;

  /**
   * Employee who created the PO. The parser accepts either a plain
   * display-name string or a `{ id, employeeName }` object for backwards
   * compatibility; the resolved shape is always `{ id, name }`. When the
   * server sends only a string, `id` is set to `0` as a sentinel.
   */
  createdBy: { id: number; name: string };

  /** ISO 8601 date the buyer expects delivery by. */
  expectedDeliveryDate?: string;

  /** Free-form notes attached to the PO. */
  remarks?: string;

  /** Sum of line totals; computed server-side. */
  totalAmount?: number;

  /** Line items associated with this PO. */
  items: PurchaseOrderItem[];
}

/**
 * Parses a raw purchase-order payload into a typed {@link PurchaseOrder}.
 *
 * Tolerates two `createdBy` shapes — a plain display-name string (legacy
 * payloads) is normalised to `{ id: 0, name: <string> }`; an object
 * payload uses `employeeName ?? name` for the display name.
 *
 * An unknown `status` value falls back to
 * {@link PurchaseOrderStatus.draft} so an unexpected backend value
 * doesn't break list rendering.
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link PurchaseOrder}.
 * @throws {TypeError} When `raw.id` is missing or non-positive, or when
 *   the object form of `createdBy` is missing `id` (propagated from
 *   {@link parsePositiveInt}).
 */
export function parsePurchaseOrder(raw: Raw): PurchaseOrder {
  return {
    id: parsePositiveInt(raw.id, 'parsePurchaseOrder.id'),
    poNumber: raw.poNumber,
    vendorId: raw.vendorId,
    vendorName: raw.vendorName ?? '',
    indentId: raw.indentId ?? undefined,
    indentNumber: raw.indentNumber ?? undefined,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    status: VALID_PO_STATUSES.has(raw.status)
      ? (raw.status as PurchaseOrderStatus)
      : PurchaseOrderStatus.draft,
    createdAt: raw.createdAt,
    createdBy:
      typeof raw.createdBy === 'string'
        ? { id: 0, name: raw.createdBy }
        : {
            id: parsePositiveInt(
              raw.createdBy?.id,
              'parsePurchaseOrder.createdBy.id'
            ),
            name: raw.createdBy?.employeeName ?? raw.createdBy?.name ?? '',
          },
    expectedDeliveryDate: raw.expectedDeliveryDate ?? undefined,
    remarks: raw.remarks ?? undefined,
    totalAmount: raw.totalAmount ?? undefined,
    items: Array.isArray(raw.items)
      ? (raw.items as Raw[]).map((item) => parsePurchaseOrderItem(item))
      : [],
  };
}
