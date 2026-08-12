/**
 * @module types/finance/invoice
 *
 * The {@link Invoice} entity and its {@link InvoiceLine} rows (backend
 * `InvoiceDto` / `InvoiceLineDto`), plus parsers. The create payload lives in
 * `invoice-create.ts` (re-exported).
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  money,
  nullableString,
  opaque,
} from '../../lib/validation/backend-schema';
import { InvoiceStatus, parseInvoiceStatus } from './finance-enums';

const InvoiceLineSchema = z.object({
  id: z.string().nullish(),
  description: nullableString,
  quantity: money,
  unitPrice: money,
  lineSubtotal: money,
  taxRate: money,
  taxAmount: money,
  lineTotal: money,
  revenueAccountId: nullableString,
  revenueAccountCode: nullableString,
});

const InvoiceSchema = z.object({
  id: z.string().nullish(),
  invoiceNumber: nullableString,
  customerId: nullableString,
  customerName: nullableString,
  invoiceDate: backendDate,
  dueDate: backendDate,
  status: opaque,
  subtotal: money,
  taxTotal: money,
  total: money,
  amountPaid: money,
  balanceDue: money,
  journalEntryId: nullableString,
  reversalJournalEntryId: nullableString,
  notes: nullableString,
  lines: z.array(z.unknown()).nullish(),
});

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
export function parseInvoiceLine(json: unknown): InvoiceLine {
  const raw = InvoiceLineSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseInvoiceLine.id'),
    description: raw.description ?? undefined,
    quantity: raw.quantity ?? 0,
    unitPrice: raw.unitPrice ?? 0,
    lineSubtotal: raw.lineSubtotal ?? 0,
    taxRate: raw.taxRate ?? 0,
    taxAmount: raw.taxAmount ?? 0,
    lineTotal: raw.lineTotal ?? 0,
    revenueAccountId: raw.revenueAccountId ?? undefined,
    revenueAccountCode: raw.revenueAccountCode ?? undefined,
  };
}

/**
 * Parses a raw invoice payload into a typed {@link Invoice}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Invoice`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseInvoice(json: unknown): Invoice {
  const raw = InvoiceSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseInvoice.id'),
    invoiceNumber: raw.invoiceNumber ?? '',
    customerId: raw.customerId ?? undefined,
    customerName: raw.customerName ?? undefined,
    invoiceDate: raw.invoiceDate ?? undefined,
    dueDate: raw.dueDate ?? undefined,
    status: parseInvoiceStatus(raw.status),
    subtotal: raw.subtotal ?? 0,
    taxTotal: raw.taxTotal ?? 0,
    total: raw.total ?? 0,
    amountPaid: raw.amountPaid ?? 0,
    balanceDue: raw.balanceDue ?? 0,
    journalEntryId: raw.journalEntryId ?? undefined,
    reversalJournalEntryId: raw.reversalJournalEntryId ?? undefined,
    notes: raw.notes ?? undefined,
    lines: Array.isArray(raw.lines)
      ? raw.lines.map((line) => parseInvoiceLine(line))
      : [],
  };
}

export {
  type CreateInvoiceRequest,
  type InvoiceLineRequest,
  createInvoiceToJson,
} from './invoice-create';
