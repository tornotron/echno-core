/**
 * @module types/finance/invoice
 *
 * The {@link Invoice} entity and its {@link InvoiceLine} rows (backend
 * `InvoiceDto` / `InvoiceLineDto`), plus parsers. The create payload lives in
 * `invoice-create.ts` (re-exported).
 */

import { parseUuid } from '../../lib/utils/parse-id';
import { InvoiceStatus, parseInvoiceStatus } from './finance-enums';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A single line on an invoice. */
export interface InvoiceLine {
  /** UUID primary key. */
  id: string;
  /** Line description. */
  description?: string;
  /** Quantity. */
  quantity: number;
  /** Unit price. */
  unitPrice: number;
  /** Line subtotal (quantity × unitPrice). */
  lineSubtotal: number;
  /** Tax rate as a percentage. */
  taxRate: number;
  /** Computed tax amount. */
  taxAmount: number;
  /** Line total (subtotal + tax). */
  lineTotal: number;
  /** GL revenue account credited for this line. */
  revenueAccountId?: string;
  /** Revenue account code (denormalized). */
  revenueAccountCode?: string;
}

/** An accounts-receivable invoice. */
export interface Invoice {
  /** UUID primary key. */
  id: string;
  /** Human-facing invoice number. */
  invoiceNumber: string;
  /** Customer id. */
  customerId?: string;
  /** Customer name (denormalized). */
  customerName?: string;
  /** Invoice date (`YYYY-MM-DD`). */
  invoiceDate?: string;
  /** Due date (`YYYY-MM-DD`). */
  dueDate?: string;
  /** Lifecycle status. */
  status: InvoiceStatus;
  /** Sum of line subtotals. */
  subtotal: number;
  /** Sum of line taxes. */
  taxTotal: number;
  /** Grand total. */
  total: number;
  /** Amount paid so far. */
  amountPaid: number;
  /** Outstanding balance. */
  balanceDue: number;
  /** Journal entry posted when the invoice was issued. */
  journalEntryId?: string;
  /** Reversal journal entry posted when the invoice was cancelled. */
  reversalJournalEntryId?: string;
  /** Free-text notes. */
  notes?: string;
  /** Invoice lines. */
  lines: InvoiceLine[];
}

/** Parses a raw invoice-line payload into a typed {@link InvoiceLine}. */
export function parseInvoiceLine(json: any): InvoiceLine {
  return {
    id: parseUuid(json.id, 'parseInvoiceLine.id'),
    description: json.description ?? undefined,
    quantity: json.quantity ?? 0,
    unitPrice: json.unitPrice ?? 0,
    lineSubtotal: json.lineSubtotal ?? 0,
    taxRate: json.taxRate ?? 0,
    taxAmount: json.taxAmount ?? 0,
    lineTotal: json.lineTotal ?? 0,
    revenueAccountId: json.revenueAccountId ?? undefined,
    revenueAccountCode: json.revenueAccountCode ?? undefined,
  };
}

/**
 * Parses a raw invoice payload into a typed {@link Invoice}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Invoice`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseInvoice(json: any): Invoice {
  return {
    id: parseUuid(json.id, 'parseInvoice.id'),
    invoiceNumber: json.invoiceNumber ?? '',
    customerId: json.customerId ?? undefined,
    customerName: json.customerName ?? undefined,
    invoiceDate: json.invoiceDate ?? undefined,
    dueDate: json.dueDate ?? undefined,
    status: parseInvoiceStatus(json.status),
    subtotal: json.subtotal ?? 0,
    taxTotal: json.taxTotal ?? 0,
    total: json.total ?? 0,
    amountPaid: json.amountPaid ?? 0,
    balanceDue: json.balanceDue ?? 0,
    journalEntryId: json.journalEntryId ?? undefined,
    reversalJournalEntryId: json.reversalJournalEntryId ?? undefined,
    notes: json.notes ?? undefined,
    lines: Array.isArray(json.lines)
      ? json.lines.map((line: any) => parseInvoiceLine(line))
      : [],
  };
}

export {
  type CreateInvoiceRequest,
  type InvoiceLineRequest,
  createInvoiceToJson,
} from './invoice-create';
