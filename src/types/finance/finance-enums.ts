/**
 * @module types/finance/finance-enums
 *
 * Shared enums for the finance (general-ledger) domain. Values mirror the
 * backend's SCREAMING_SNAKE_CASE strings exactly, so they round-trip through
 * the API without translation.
 */

/** Ledger account classification. */
export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

/** Lifecycle state of an AR invoice. */
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

/** Lifecycle state of a journal entry. (`DRAFT` exists but the backend posts immediately.) */
export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

/**
 * A configurable posting role in the automatic-posting configuration: each role
 * names a ledger account the backend posts to when a document (invoice,
 * payment, tax line) hits the general ledger.
 */
export enum PostingRole {
  ACCOUNTS_RECEIVABLE = 'ACCOUNTS_RECEIVABLE',
  GST_OUTPUT = 'GST_OUTPUT',
  ACCOUNTS_PAYABLE = 'ACCOUNTS_PAYABLE',
  GST_INPUT = 'GST_INPUT',
  DEFAULT_REVENUE = 'DEFAULT_REVENUE',
  DEFAULT_EXPENSE = 'DEFAULT_EXPENSE',
}

/**
 * Human-readable label for each {@link PostingRole}. Use this when rendering the
 * enum in the UI; the enum value remains the API of record.
 */
export const postingRoleLabels: Record<PostingRole, string> = {
  [PostingRole.ACCOUNTS_RECEIVABLE]: 'Accounts Receivable',
  [PostingRole.GST_OUTPUT]: 'GST Output',
  [PostingRole.ACCOUNTS_PAYABLE]: 'Accounts Payable',
  [PostingRole.GST_INPUT]: 'GST Input',
  [PostingRole.DEFAULT_REVENUE]: 'Default Revenue',
  [PostingRole.DEFAULT_EXPENSE]: 'Default Expense',
};

/**
 * How a posting account was resolved for a {@link PostingRole}: `MAPPED` when an
 * explicit mapping exists, `DEFAULT` when the backend fell back to a built-in
 * default account.
 */
export enum PostingAccountSource {
  MAPPED = 'MAPPED',
  DEFAULT = 'DEFAULT',
}

/**
 * Narrows an untyped backend string to {@link AccountType}, defaulting to
 * `ASSET` when the value is absent or unrecognized.
 */
export function parseAccountType(raw: unknown): AccountType {
  return typeof raw === 'string' &&
    (Object.values(AccountType) as string[]).includes(raw)
    ? (raw as AccountType)
    : AccountType.ASSET;
}

/**
 * Narrows an untyped backend string to {@link InvoiceStatus}, defaulting to
 * `DRAFT` when the value is absent or unrecognized.
 */
export function parseInvoiceStatus(raw: unknown): InvoiceStatus {
  return typeof raw === 'string' &&
    (Object.values(InvoiceStatus) as string[]).includes(raw)
    ? (raw as InvoiceStatus)
    : InvoiceStatus.DRAFT;
}

/**
 * Narrows an untyped backend string to {@link JournalEntryStatus}, defaulting
 * to `POSTED` when the value is absent or unrecognized (the backend posts
 * entries immediately).
 */
export function parseJournalEntryStatus(raw: unknown): JournalEntryStatus {
  return typeof raw === 'string' &&
    (Object.values(JournalEntryStatus) as string[]).includes(raw)
    ? (raw as JournalEntryStatus)
    : JournalEntryStatus.POSTED;
}

/**
 * Narrows an untyped backend string to {@link PostingRole}, defaulting to
 * `DEFAULT_REVENUE` when the value is absent or unrecognized.
 */
export function parsePostingRole(raw: unknown): PostingRole {
  return typeof raw === 'string' &&
    (Object.values(PostingRole) as string[]).includes(raw)
    ? (raw as PostingRole)
    : PostingRole.DEFAULT_REVENUE;
}

/**
 * Narrows an untyped backend string to {@link PostingAccountSource}, defaulting
 * to `DEFAULT` when the value is absent or unrecognized.
 */
export function parsePostingAccountSource(raw: unknown): PostingAccountSource {
  return typeof raw === 'string' &&
    (Object.values(PostingAccountSource) as string[]).includes(raw)
    ? (raw as PostingAccountSource)
    : PostingAccountSource.DEFAULT;
}
