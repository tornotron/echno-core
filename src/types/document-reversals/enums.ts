/**
 * @module document-reversals/enums
 *
 * Enumerated values shared by the document-reversals domain.
 */

/**
 * The kinds of document a reversal may be raised against. A closed set: the
 * server resolves each within the caller's organization before anything is
 * written, and refuses any other value.
 */
export enum ReversibleDocumentType {
  /** A site transfer: its outbound leg, and its inbound leg where written, are undone. */
  siteTransfer = 'SITE_TRANSFER',

  /** A purchase order: it writes no stock, so its reversal is a status change and a link. */
  purchaseOrder = 'PURCHASE_ORDER',

  /** A goods received note: the receipt is undone and the order's received quantities fall back. */
  goodsReceivedNote = 'GOODS_RECEIVED_NOTE',
}

/** Human-readable label for each {@link ReversibleDocumentType}. */
export const reversibleDocumentTypeLabels: Record<ReversibleDocumentType, string> =
  {
    [ReversibleDocumentType.siteTransfer]: 'Site transfer',
    [ReversibleDocumentType.purchaseOrder]: 'Purchase order',
    [ReversibleDocumentType.goodsReceivedNote]: 'Goods received note',
  };

/**
 * Where a reversal request stands.
 *
 * {@link DocumentReversalStatus.pending} is the only state a request is
 * written in and the only one it leaves. The three ways out are terminal: an
 * approver undoes the document, an approver refuses with a reason, or the
 * requester withdraws it.
 */
export enum DocumentReversalStatus {
  /** Raised and awaiting an approver's decision. The approvals queue. */
  pending = 'PENDING',

  /** Approved: the document's movements were undone and it is marked reversed. */
  approved = 'APPROVED',

  /** Refused by an approver, with the reason kept on the record. */
  rejected = 'REJECTED',

  /** Withdrawn by the requester before a decision. */
  cancelled = 'CANCELLED',
}

/** Human-readable label for each {@link DocumentReversalStatus}. */
export const documentReversalStatusLabels: Record<DocumentReversalStatus, string> =
  {
    [DocumentReversalStatus.pending]: 'Pending',
    [DocumentReversalStatus.approved]: 'Approved',
    [DocumentReversalStatus.rejected]: 'Rejected',
    [DocumentReversalStatus.cancelled]: 'Cancelled',
  };

/**
 * Tailwind badge utility classes (background + text, with dark-mode
 * variants) for each {@link DocumentReversalStatus}.
 */
export const documentReversalStatusBadgeColors: Record<
  DocumentReversalStatus,
  string
> = {
  [DocumentReversalStatus.pending]:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  [DocumentReversalStatus.approved]:
    'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  [DocumentReversalStatus.rejected]:
    'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  [DocumentReversalStatus.cancelled]:
    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};
