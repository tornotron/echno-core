/**
 * @module types/finance/construction-invoice
 *
 * The {@link ConstructionInvoice} entity and its {@link ConstructionInvoiceLine}
 * rows (backend `ConstructionInvoiceDto` / `ConstructionInvoiceLineDto`), plus
 * parsers, the invoice enums, and the create / update request payloads with
 * their serializers.
 *
 * Unlike the accounts-receivable invoice, the construction invoice keys its
 * foreign references (project, vendor, purchase order, goods receipt) by the
 * numeric surrogate ids used across the operational modules; only its own
 * primary key and the payment link are UUID strings. Money totals (subtotal,
 * tax, discount, total, paid, balance) are computed server-side; the client
 * supplies only the line inputs on create and update.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  money,
  nullableString,
  numericId,
  optionalNumericId,
  opaque,
} from '../../lib/validation/backend-schema';

/** Nature of a construction invoice. */
export enum ConstructionInvoiceType {
  PURCHASE = 'PURCHASE',
  SALES = 'SALES',
  EXPENSE = 'EXPENSE',
  SERVICE = 'SERVICE',
}

/** Lifecycle state of a construction invoice. */
export enum ConstructionInvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  SENT = 'SENT',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

/** Payment-progress of a construction invoice (how much has been settled). */
export enum ConstructionInvoicePaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

/**
 * Narrows an untyped backend string to {@link ConstructionInvoiceType},
 * defaulting to `PURCHASE` when the value is absent or unrecognized.
 */
export function parseConstructionInvoiceType(
  raw: unknown
): ConstructionInvoiceType {
  return typeof raw === 'string' &&
    (Object.values(ConstructionInvoiceType) as string[]).includes(raw)
    ? (raw as ConstructionInvoiceType)
    : ConstructionInvoiceType.PURCHASE;
}

/**
 * Narrows an untyped backend string to {@link ConstructionInvoiceStatus},
 * defaulting to `DRAFT` when the value is absent or unrecognized.
 */
export function parseConstructionInvoiceStatus(
  raw: unknown
): ConstructionInvoiceStatus {
  return typeof raw === 'string' &&
    (Object.values(ConstructionInvoiceStatus) as string[]).includes(raw)
    ? (raw as ConstructionInvoiceStatus)
    : ConstructionInvoiceStatus.DRAFT;
}

/**
 * Narrows an untyped backend string to {@link ConstructionInvoicePaymentStatus},
 * defaulting to `UNPAID` when the value is absent or unrecognized.
 */
export function parseConstructionInvoicePaymentStatus(
  raw: unknown
): ConstructionInvoicePaymentStatus {
  return typeof raw === 'string' &&
    (Object.values(ConstructionInvoicePaymentStatus) as string[]).includes(raw)
    ? (raw as ConstructionInvoicePaymentStatus)
    : ConstructionInvoicePaymentStatus.UNPAID;
}

const ConstructionInvoiceLineSchema = z.object({
  id: z.string().nullish(),
  description: nullableString,
  quantity: money,
  unit: nullableString,
  unitPrice: money,
  taxRate: money,
  taxAmount: money,
  discountRate: money,
  discountAmount: money,
  subtotal: money,
  total: money,
  inventoryItemId: optionalNumericId,
  assetId: optionalNumericId,
  taskId: optionalNumericId,
  costCategoryId: nullableString,
  costCategoryName: nullableString,
});

const ConstructionInvoiceSchema = z.object({
  id: z.string().nullish(),
  invoiceNumber: nullableString,
  type: opaque,
  status: opaque,
  paymentStatus: opaque,
  projectId: numericId,
  vendorId: optionalNumericId,
  purchaseOrderId: optionalNumericId,
  goodsReceiptId: optionalNumericId,
  issueDate: backendDate,
  dueDate: backendDate,
  paymentDate: backendDate,
  subtotal: money,
  taxAmount: money,
  discountAmount: money,
  totalAmount: money,
  paidAmount: money,
  balanceAmount: money,
  paymentTerms: nullableString,
  paymentMethod: nullableString,
  gstNumber: nullableString,
  taxType: nullableString,
  notes: nullableString,
  termsAndConditions: nullableString,
  submittedBy: optionalNumericId,
  submittedByName: nullableString,
  submittedAt: backendDate,
  approvedBy: optionalNumericId,
  approvedByName: nullableString,
  approvedAt: backendDate,
  paymentRecordedBy: optionalNumericId,
  paymentRecordedByName: nullableString,
  journalEntryId: nullableString,
  reversalJournalEntryId: nullableString,
  arInvoiceId: nullableString,
  lines: z.array(z.unknown()).nullish(),
});

/** A single line on a construction invoice. */
export interface ConstructionInvoiceLine {
  /** UUID primary key. */
  id: string;
  /** Line description. */
  description?: string;
  /** Quantity. */
  quantity: number;
  /** Unit of measure. */
  unit: string;
  /** Unit price. */
  unitPrice: number;
  /** Tax rate as a percentage. */
  taxRate: number;
  /** Computed tax amount. */
  taxAmount: number;
  /** Discount rate as a percentage. */
  discountRate: number;
  /** Computed discount amount. */
  discountAmount: number;
  /** Line subtotal before tax and discount. */
  subtotal: number;
  /** Line total (subtotal + tax - discount). */
  total: number;
  /** Linked inventory item id. */
  inventoryItemId?: number;
  /** Linked asset id. */
  assetId?: number;
  /** Linked task id. */
  taskId?: number;
  /** UUID of the cost category tagged on the line, if any. */
  costCategoryId?: string | null;
  /** Name of the cost category tagged on the line, if any. */
  costCategoryName?: string | null;
}

/** A construction invoice (purchase, sales, expense, or service). */
export interface ConstructionInvoice {
  /** UUID primary key. */
  id: string;
  /** Human-facing invoice number. */
  invoiceNumber: string;
  /** Invoice nature. */
  type: ConstructionInvoiceType;
  /** Lifecycle status. */
  status: ConstructionInvoiceStatus;
  /** Payment-progress status. */
  paymentStatus: ConstructionInvoicePaymentStatus;
  /** Project the invoice belongs to. */
  projectId: number;
  /** Vendor id (for purchase / expense invoices). */
  vendorId?: number;
  /** Source purchase order id. */
  purchaseOrderId?: number;
  /** Source goods-receipt id. */
  goodsReceiptId?: number;
  /** Issue date (`YYYY-MM-DD`). */
  issueDate?: string;
  /** Due date (`YYYY-MM-DD`). */
  dueDate?: string;
  /** Date the invoice was fully paid (`YYYY-MM-DD`). */
  paymentDate?: string;
  /** Sum of line subtotals. */
  subtotal: number;
  /** Sum of line taxes. */
  taxAmount: number;
  /** Sum of line discounts. */
  discountAmount: number;
  /** Grand total. */
  totalAmount: number;
  /** Amount paid so far. */
  paidAmount: number;
  /** Outstanding balance. */
  balanceAmount: number;
  /** Payment terms (free text). */
  paymentTerms?: string;
  /** Preferred payment method (free text). */
  paymentMethod?: string;
  /** GST number. */
  gstNumber?: string;
  /** Tax type (free text). */
  taxType?: string;
  /** Free-text notes. */
  notes?: string;
  /** Terms and conditions. */
  termsAndConditions?: string;
  /** Id of the user who submitted the invoice for approval (server-set). */
  submittedBy?: number;
  /**
   * Display name of the user in {@link submittedBy}, resolved server-side
   * (server-set).
   *
   * Set whenever `submittedBy` is, and undefined only when it is not, so the
   * two questions a screen asks stay separable: an invoice never submitted has
   * neither, and one submitted by an account since deleted still carries the
   * literal `User #<id>` here rather than nothing. An account holding no name
   * falls back to its email.
   *
   * It is resolved from the `users` table, which is why it exists at all: these
   * stamps are user ids, and the employee lookup a screen would otherwise reach
   * for is keyed by a different sequence, so it misses for most of them and
   * names the wrong person on a collision.
   */
  submittedByName?: string;
  /** Timestamp the invoice was submitted, ISO-8601 (server-set). */
  submittedAt?: string;
  /** Id of the user who approved the invoice (server-set). */
  approvedBy?: number;
  /**
   * Display name of the user in {@link approvedBy}, resolved server-side
   * (server-set). Same contract as {@link submittedByName}: present with the
   * id, absent without it.
   */
  approvedByName?: string;
  /** Timestamp the invoice was approved, ISO-8601 (server-set). */
  approvedAt?: string;
  /** Id of the user who recorded the latest payment (server-set). */
  paymentRecordedBy?: number;
  /**
   * Display name of the user in {@link paymentRecordedBy}, resolved server-side
   * (server-set). Same contract as {@link submittedByName}: present with the
   * id, absent without it.
   */
  paymentRecordedByName?: string;
  /** UUID of the ledger journal entry posted on approval (server-set). */
  journalEntryId?: string;
  /** UUID of the reversal journal entry posted on cancellation (server-set). */
  reversalJournalEntryId?: string;
  /**
   * UUID of the accounts-receivable invoice this construction invoice raised on
   * approval, present on a sales or service invoice only (server-set).
   *
   * It is the join between the two documents, and the reason a receivables
   * screen can tell a row it must not offer to cancel: `InvoiceService.cancel`
   * refuses an invoice a construction invoice raised, by name. Without this the
   * screen has to offer the action and let the backend refuse.
   */
  arInvoiceId?: string;
  /** Invoice lines. */
  lines: ConstructionInvoiceLine[];
}

/**
 * Parses a raw construction-invoice-line payload into a typed
 * {@link ConstructionInvoiceLine}.
 */
export function parseConstructionInvoiceLine(
  json: unknown
): ConstructionInvoiceLine {
  const raw = ConstructionInvoiceLineSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseConstructionInvoiceLine.id'),
    description: raw.description ?? undefined,
    quantity: raw.quantity ?? 0,
    unit: raw.unit ?? '',
    unitPrice: raw.unitPrice ?? 0,
    taxRate: raw.taxRate ?? 0,
    taxAmount: raw.taxAmount ?? 0,
    discountRate: raw.discountRate ?? 0,
    discountAmount: raw.discountAmount ?? 0,
    subtotal: raw.subtotal ?? 0,
    total: raw.total ?? 0,
    inventoryItemId: raw.inventoryItemId ?? undefined,
    assetId: raw.assetId ?? undefined,
    taskId: raw.taskId ?? undefined,
    costCategoryId: raw.costCategoryId ?? null,
    costCategoryName: raw.costCategoryName ?? null,
  };
}

/**
 * Parses a raw construction-invoice payload into a typed
 * {@link ConstructionInvoice}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `ConstructionInvoice`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseConstructionInvoice(json: unknown): ConstructionInvoice {
  const raw = ConstructionInvoiceSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseConstructionInvoice.id'),
    invoiceNumber: raw.invoiceNumber ?? '',
    type: parseConstructionInvoiceType(raw.type),
    status: parseConstructionInvoiceStatus(raw.status),
    paymentStatus: parseConstructionInvoicePaymentStatus(raw.paymentStatus),
    projectId: raw.projectId,
    vendorId: raw.vendorId ?? undefined,
    purchaseOrderId: raw.purchaseOrderId ?? undefined,
    goodsReceiptId: raw.goodsReceiptId ?? undefined,
    issueDate: raw.issueDate ?? undefined,
    dueDate: raw.dueDate ?? undefined,
    paymentDate: raw.paymentDate ?? undefined,
    subtotal: raw.subtotal ?? 0,
    taxAmount: raw.taxAmount ?? 0,
    discountAmount: raw.discountAmount ?? 0,
    totalAmount: raw.totalAmount ?? 0,
    paidAmount: raw.paidAmount ?? 0,
    balanceAmount: raw.balanceAmount ?? 0,
    paymentTerms: raw.paymentTerms ?? undefined,
    paymentMethod: raw.paymentMethod ?? undefined,
    gstNumber: raw.gstNumber ?? undefined,
    taxType: raw.taxType ?? undefined,
    notes: raw.notes ?? undefined,
    termsAndConditions: raw.termsAndConditions ?? undefined,
    submittedBy: raw.submittedBy ?? undefined,
    submittedByName: raw.submittedByName ?? undefined,
    submittedAt: raw.submittedAt ?? undefined,
    approvedBy: raw.approvedBy ?? undefined,
    approvedByName: raw.approvedByName ?? undefined,
    approvedAt: raw.approvedAt ?? undefined,
    paymentRecordedBy: raw.paymentRecordedBy ?? undefined,
    paymentRecordedByName: raw.paymentRecordedByName ?? undefined,
    journalEntryId: raw.journalEntryId ?? undefined,
    reversalJournalEntryId: raw.reversalJournalEntryId ?? undefined,
    arInvoiceId: raw.arInvoiceId ?? undefined,
    lines: Array.isArray(raw.lines)
      ? raw.lines.map((line) => parseConstructionInvoiceLine(line))
      : [],
  };
}

/**
 * A single line on a create / update construction-invoice request. Amounts are
 * computed server-side from these inputs, so only quantity, unit price and the
 * percentage rates are supplied.
 */
export interface ConstructionInvoiceLineRequest {
  /** Line description (max 500). Required. */
  description: string;
  /** Quantity (> 0). Required. */
  quantity: number;
  /** Unit of measure (max 50). Required. */
  unit: string;
  /** Unit price (>= 0). Required. */
  unitPrice: number;
  /** Tax rate as a percentage (0–100). */
  taxRate?: number;
  /** Discount rate as a percentage (0–100). */
  discountRate?: number;
  /** Linked inventory item id. */
  inventoryItemId?: number;
  /** Linked asset id. */
  assetId?: number;
  /** Linked task id. */
  taskId?: number;
  /** UUID of the cost category to tag the line with. */
  costCategoryId?: string | null;
}

/** Fields for creating a construction invoice. */
export interface CreateConstructionInvoiceRequest {
  /** Invoice nature. Required. */
  type: ConstructionInvoiceType;
  /** Project the invoice belongs to. Required. */
  projectId: number;
  /** Vendor id. */
  vendorId?: number;
  /** Source purchase order id. */
  purchaseOrderId?: number;
  /** Source goods-receipt id. */
  goodsReceiptId?: number;
  /** Issue date (`YYYY-MM-DD`). Required. */
  issueDate: string;
  /** Due date (`YYYY-MM-DD`). Required. */
  dueDate: string;
  /** Payment terms (max 100). */
  paymentTerms?: string;
  /** Payment method (max 50). */
  paymentMethod?: string;
  /** GST number (max 30). */
  gstNumber?: string;
  /** Tax type (max 20). */
  taxType?: string;
  /** Free-text notes (max 1000). */
  notes?: string;
  /** Terms and conditions (max 2000). */
  termsAndConditions?: string;
  /** Invoice lines. At least one required. */
  lines: ConstructionInvoiceLineRequest[];
}

/**
 * Fields for updating a construction invoice (full replacement). Status and
 * payment status are set directly; money totals are recomputed from the lines.
 */
export interface UpdateConstructionInvoiceRequest {
  /** Invoice nature. Required. */
  type: ConstructionInvoiceType;
  /** Lifecycle status. Required. */
  status: ConstructionInvoiceStatus;
  /** Payment-progress status. Required. */
  paymentStatus: ConstructionInvoicePaymentStatus;
  /** Project the invoice belongs to. Required. */
  projectId: number;
  /** Vendor id. */
  vendorId?: number;
  /** Source purchase order id. */
  purchaseOrderId?: number;
  /** Source goods-receipt id. */
  goodsReceiptId?: number;
  /** Issue date (`YYYY-MM-DD`). Required. */
  issueDate: string;
  /** Due date (`YYYY-MM-DD`). Required. */
  dueDate: string;
  /** Date the invoice was fully paid (`YYYY-MM-DD`). */
  paymentDate?: string;
  /** Payment terms (max 100). */
  paymentTerms?: string;
  /** Payment method (max 50). */
  paymentMethod?: string;
  /** GST number (max 30). */
  gstNumber?: string;
  /** Tax type (max 20). */
  taxType?: string;
  /** Free-text notes (max 1000). */
  notes?: string;
  /** Terms and conditions (max 2000). */
  termsAndConditions?: string;
  /** Invoice lines. At least one required. */
  lines: ConstructionInvoiceLineRequest[];
}

/**
 * Serializes a {@link ConstructionInvoiceLineRequest} into a backend line
 * object. Required fields are always emitted; optional inputs only when set.
 */
function constructionInvoiceLineToJson(
  line: ConstructionInvoiceLineRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
  };
  if (line.taxRate !== undefined) json.taxRate = line.taxRate;
  if (line.discountRate !== undefined) json.discountRate = line.discountRate;
  if (line.inventoryItemId !== undefined)
    json.inventoryItemId = line.inventoryItemId;
  if (line.assetId !== undefined) json.assetId = line.assetId;
  if (line.taskId !== undefined) json.taskId = line.taskId;
  if (line.costCategoryId !== undefined)
    json.costCategoryId = line.costCategoryId;
  return json;
}

/**
 * Serializes a {@link CreateConstructionInvoiceRequest} into the backend
 * request body.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching `CreateConstructionInvoiceRequest`.
 */
export function createConstructionInvoiceToJson(
  dto: CreateConstructionInvoiceRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    type: dto.type,
    projectId: dto.projectId,
    issueDate: dto.issueDate,
    dueDate: dto.dueDate,
    lines: dto.lines.map((line) => constructionInvoiceLineToJson(line)),
  };
  if (dto.vendorId !== undefined) json.vendorId = dto.vendorId;
  if (dto.purchaseOrderId !== undefined)
    json.purchaseOrderId = dto.purchaseOrderId;
  if (dto.goodsReceiptId !== undefined)
    json.goodsReceiptId = dto.goodsReceiptId;
  if (dto.paymentTerms !== undefined) json.paymentTerms = dto.paymentTerms;
  if (dto.paymentMethod !== undefined) json.paymentMethod = dto.paymentMethod;
  if (dto.gstNumber !== undefined) json.gstNumber = dto.gstNumber;
  if (dto.taxType !== undefined) json.taxType = dto.taxType;
  if (dto.notes !== undefined) json.notes = dto.notes;
  if (dto.termsAndConditions !== undefined)
    json.termsAndConditions = dto.termsAndConditions;
  return json;
}

/**
 * Serializes an {@link UpdateConstructionInvoiceRequest} into the backend
 * request body.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching `UpdateConstructionInvoiceRequest`.
 */
export function updateConstructionInvoiceToJson(
  dto: UpdateConstructionInvoiceRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    type: dto.type,
    status: dto.status,
    paymentStatus: dto.paymentStatus,
    projectId: dto.projectId,
    issueDate: dto.issueDate,
    dueDate: dto.dueDate,
    lines: dto.lines.map((line) => constructionInvoiceLineToJson(line)),
  };
  if (dto.vendorId !== undefined) json.vendorId = dto.vendorId;
  if (dto.purchaseOrderId !== undefined)
    json.purchaseOrderId = dto.purchaseOrderId;
  if (dto.goodsReceiptId !== undefined)
    json.goodsReceiptId = dto.goodsReceiptId;
  if (dto.paymentDate !== undefined) json.paymentDate = dto.paymentDate;
  if (dto.paymentTerms !== undefined) json.paymentTerms = dto.paymentTerms;
  if (dto.paymentMethod !== undefined) json.paymentMethod = dto.paymentMethod;
  if (dto.gstNumber !== undefined) json.gstNumber = dto.gstNumber;
  if (dto.taxType !== undefined) json.taxType = dto.taxType;
  if (dto.notes !== undefined) json.notes = dto.notes;
  if (dto.termsAndConditions !== undefined)
    json.termsAndConditions = dto.termsAndConditions;
  return json;
}
