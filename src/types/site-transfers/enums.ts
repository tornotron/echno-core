/**
 * @module site-transfers/enums
 *
 * Enumerated values shared by the site-transfers domain.
 */

/**
 * Lifecycle state of a {@link SiteTransfer}.
 *
 * Every state follows from a movement. A client does not choose one:
 * `PATCH /site-transfers/web/{id}/status` refuses whatever it is handed
 * (echno-backend#660). A transfer is moved on by recording what arrived
 * ({@link useReceiveSiteTransfer}) or by abandoning it in transit
 * ({@link useCancelSiteTransfer}).
 */
export enum SiteTransferStatus {
  /**
   * Raised and dispatched, with nothing confirmed at the far end.
   *
   * The outbound leg is already posted, so the stock has left the sending
   * location: `PENDING` says it is on a lorry, not that it is still in the
   * yard. Only a transfer in this state can be cancelled.
   */
  pending = 'PENDING',

  /** Some line items have been received at the destination; others outstanding. */
  partiallyTransferred = 'PARTIALLY_TRANSFERRED',

  /**
   * Every line has been confirmed at the destination in full.
   *
   * A transfer between two stores on one project is created holding this,
   * because the material never leaves that site's custody and there is no
   * arrival for anybody to confirm.
   */
  completed = 'COMPLETED',

  /**
   * Abandoned in transit, its outbound leg reversed onto the sending balance.
   *
   * Reachable only from {@link SiteTransferStatus.pending}: once part of a
   * delivery has been taken, the material is standing at the far site and its
   * fate is a stock adjustment rather than a reversal.
   */
  cancelled = 'CANCELLED',
}

/**
 * Human-readable label for each {@link SiteTransferStatus}. Use this
 * when rendering the enum in the UI; the enum value remains the API
 * of record.
 */
export const siteTransferStatusLabels: Record<SiteTransferStatus, string> = {
  [SiteTransferStatus.pending]: 'Pending',
  [SiteTransferStatus.partiallyTransferred]: 'Partially Transferred',
  [SiteTransferStatus.completed]: 'Completed',
  [SiteTransferStatus.cancelled]: 'Cancelled',
};

/**
 * Tailwind badge utility classes (background + text, with dark-mode
 * variants) for each {@link SiteTransferStatus}. Sourced from
 * echno-web's status-pill design; downstream consumers may override
 * via their own theme map.
 */
export const siteTransferStatusBadgeColors: Record<SiteTransferStatus, string> =
  {
    [SiteTransferStatus.pending]:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    [SiteTransferStatus.partiallyTransferred]:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    [SiteTransferStatus.completed]:
      'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    [SiteTransferStatus.cancelled]:
      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  };
