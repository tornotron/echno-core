/**
 * @module indents/enums
 *
 * Enumerated values shared by the indents (requisitions) domain.
 */

/**
 * Lifecycle state of an {@link Indent}. Indent status is set by the
 * creator and advanced as line items are converted to purchase orders or
 * received on site.
 */
export enum IndentStatus {
  /** Newly raised; not yet acted on. */
  pending = 'PENDING',

  /** One or more line items have been converted to a purchase order. */
  ordered = 'ORDERED',

  /** Materials have been received at the site. */
  onSite = 'ON_SITE',

  /** Expected delivery is past due and outstanding. */
  delayed = 'DELAYED',

  /** Cancelled before completion. */
  cancelled = 'CANCELLED',
}

/**
 * Human-readable label for each {@link IndentStatus}. Use this when
 * rendering the enum in the UI; the enum value remains the API of record.
 */
export const indentStatusLabels: Record<IndentStatus, string> = {
  [IndentStatus.pending]: 'Pending',
  [IndentStatus.ordered]: 'Ordered',
  [IndentStatus.onSite]: 'On Site',
  [IndentStatus.delayed]: 'Delayed',
  [IndentStatus.cancelled]: 'Cancelled',
};

/**
 * Tailwind badge utility classes (background + text) for each
 * {@link IndentStatus}. Sourced from echno-web's status-pill design;
 * downstream consumers may override via their own theme map.
 */
export const indentStatusBadgeColors: Record<IndentStatus, string> = {
  [IndentStatus.pending]: 'bg-yellow-100 text-yellow-700',
  [IndentStatus.ordered]: 'bg-blue-100 text-blue-700',
  [IndentStatus.onSite]: 'bg-green-100 text-green-700',
  [IndentStatus.delayed]: 'bg-red-100 text-red-700',
  [IndentStatus.cancelled]: 'bg-zinc-100 text-zinc-700',
};
