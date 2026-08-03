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
