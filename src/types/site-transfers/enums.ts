/**
 * @module site-transfers/enums
 *
 * Enumerated values shared by the site-transfers domain.
 */

/**
 * Lifecycle state of a {@link SiteTransfer}. Status transitions are
 * driven server-side; clients change status via
 * {@link useUpdateSiteTransferStatus}
 * (`PATCH /site-transfers/web/{id}/status`).
 */
export enum SiteTransferStatus {
  /** Newly raised; goods have not left the sending location yet. */
  pending = 'PENDING',

  /** Some line items have been received at the destination; others outstanding. */
  partiallyTransferred = 'PARTIALLY_TRANSFERRED',

  /** Every line item has been received at the destination. */
  completed = 'COMPLETED',
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
  };
