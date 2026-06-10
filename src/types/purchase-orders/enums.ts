/**
 * @module purchase-orders/enums
 *
 * Enumerated values shared by the purchase-orders domain.
 */

/**
 * Lifecycle state of a {@link PurchaseOrder}. Status transitions are
 * driven server-side; clients change status via
 * {@link useUpdatePOStatus} (`PATCH /purchase-orders/web/{id}/status`).
 */
export enum PurchaseOrderStatus {
  /** Newly created, not yet approved. Editable. */
  draft = 'DRAFT',

  /** Approved internally; ready to send to the vendor. */
  approved = 'APPROVED',

  /** Sent to the vendor and awaiting delivery. */
  sentToVendor = 'SENT_TO_VENDOR',

  /** Some line items have been received; others outstanding. */
  partiallyReceived = 'PARTIALLY_RECEIVED',

  /** Every line item has been received in full. */
  fullyReceived = 'FULLY_RECEIVED',

  /** Cancelled before completion. Cannot be re-opened. */
  cancelled = 'CANCELLED',
}

/**
 * Human-readable label for each {@link PurchaseOrderStatus}. Use this when
 * rendering the enum in the UI; the enum value remains the API of record.
 */
export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.draft]: 'Draft',
  [PurchaseOrderStatus.approved]: 'Approved',
  [PurchaseOrderStatus.sentToVendor]: 'Sent to Vendor',
  [PurchaseOrderStatus.partiallyReceived]: 'Partially Received',
  [PurchaseOrderStatus.fullyReceived]: 'Fully Received',
  [PurchaseOrderStatus.cancelled]: 'Cancelled',
};

/**
 * Tailwind badge utility classes (background + text) for each
 * {@link PurchaseOrderStatus}. Sourced from echno-web's status-pill design;
 * downstream consumers may override via their own theme map.
 */
export const purchaseOrderStatusBadgeColors: Record<
  PurchaseOrderStatus,
  string
> = {
  [PurchaseOrderStatus.draft]: 'bg-zinc-100 text-zinc-700',
  [PurchaseOrderStatus.approved]: 'bg-blue-100 text-blue-700',
  [PurchaseOrderStatus.sentToVendor]: 'bg-purple-100 text-purple-700',
  [PurchaseOrderStatus.partiallyReceived]: 'bg-orange-100 text-orange-700',
  [PurchaseOrderStatus.fullyReceived]: 'bg-green-100 text-green-700',
  [PurchaseOrderStatus.cancelled]: 'bg-red-100 text-red-700',
};
