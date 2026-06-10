/**
 * @module vendor-summary
 *
 * Lightweight financial-rollup view of a vendor. Returned by
 * `GET /vendors/web/{id}/summary` and cached separately from the full
 * {@link Vendor} entity because its derived fields are recomputed
 * server-side on every read.
 */

/**
 * Aggregated order and payment metrics for one vendor. All metrics are
 * computed server-side; the client never derives these values.
 */
export interface VendorSummary {
  /** Surrogate ID of the vendor this summary describes. */
  vendorId: number;

  /** Display name of the vendor, snapshotted into the summary payload. */
  vendorName: string;

  /** Total purchase orders ever raised against this vendor. */
  totalOrders?: number;

  /** Orders currently open or awaiting fulfilment. */
  pendingOrders?: number;

  /** Orders fully received and closed. */
  completedOrders?: number;

  /** Orders cancelled before or during fulfilment. */
  cancelledOrders?: number;

  /** Cumulative monetary value of all purchase orders, in the organisation's base currency. */
  totalPurchaseValue?: number;

  /** Cumulative amount paid to the vendor to date. */
  totalPaid?: number;

  /** Outstanding balance owed to the vendor (`totalPurchaseValue - totalPaid`, minus adjustments). */
  totalOutstanding?: number;

  /** Date of the most recent payment to this vendor. */
  lastPaymentDate?: Date;

  /** Amount of the most recent payment. */
  lastPaymentAmount?: number;
}
