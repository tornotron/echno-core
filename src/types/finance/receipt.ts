/**
 * @module types/finance/receipt
 *
 * The {@link Receipt} entity (backend `ReceiptDto`), its parser, the receipt
 * enums, and the create / update request payloads with their serializers.
 *
 * A receipt records money received against a project or the organization
 * (a payment, an advance, a security deposit, a refund). Like the expense, the
 * receipt keys its own primary key and every foreign reference (project,
 * payment, invoice, customer, organization) by the numeric surrogate ids used
 * across the operational modules. Type and status are stored as plain lowercase
 * strings on the backend; the parser narrows them to the enums below, defaulting
 * an unknown or absent value to a sensible member. The receipt number is
 * generated server-side and is not accepted on create or update.
 */

import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import {
  backendDate,
  money,
  nullableString,
  numericId,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

/** Kind of receipt. */
export enum ReceiptType {
  payment = 'payment',
  advance = 'advance',
  deposit = 'deposit',
  refund = 'refund',
  other = 'other',
}

/** Lifecycle status of a receipt. */
export enum ReceiptStatus {
  draft = 'draft',
  issued = 'issued',
  cancelled = 'cancelled',
}

/**
 * Narrows an untyped backend string to {@link ReceiptType}, defaulting to
 * `payment` when the value is absent or unrecognized.
 */
export function parseReceiptType(raw: unknown): ReceiptType {
  return typeof raw === 'string' &&
    (Object.values(ReceiptType) as string[]).includes(raw)
    ? (raw as ReceiptType)
    : ReceiptType.payment;
}

/**
 * Narrows an untyped backend string to {@link ReceiptStatus}, defaulting to
 * `draft` when the value is absent or unrecognized.
 */
export function parseReceiptStatus(raw: unknown): ReceiptStatus {
  return typeof raw === 'string' &&
    (Object.values(ReceiptStatus) as string[]).includes(raw)
    ? (raw as ReceiptStatus)
    : ReceiptStatus.draft;
}

const ReceiptSchema = z.object({
  id: numericId,
  receiptNumber: nullableString,
  type: nullableString,
  status: nullableString,
  amount: money,
  currency: nullableString,
  receiptDate: backendDate,
  paymentMethod: nullableString,
  transactionId: nullableString,
  referenceNumber: nullableString,
  receivedFrom: nullableString,
  receivedFromAddress: nullableString,
  taxAmount: money,
  taxRate: money,
  taxType: nullableString,
  description: nullableString,
  notes: nullableString,
  issuedBy: optionalNumericId,
  projectId: optionalNumericId,
  paymentId: optionalNumericId,
  invoiceId: optionalNumericId,
  customerId: optionalNumericId,
  organizationId: optionalNumericId,
  createdAt: backendDate,
  updatedAt: backendDate,
});

/** A recorded receipt of money against a project or the organization. */
export interface Receipt {
  /** Numeric surrogate primary key. */
  id: number;
  /** Server-generated receipt number (e.g. `RCP-2027-000001`). */
  receiptNumber: string;
  /** Kind of receipt. */
  type: ReceiptType;
  /** Lifecycle status. */
  status: ReceiptStatus;
  /** Amount received in {@link currency}. */
  amount: number;
  /** Currency code for the amount (e.g. `INR`). */
  currency: string;
  /** Date the amount was received. */
  receiptDate?: Date;
  /** How the amount was received (free text). */
  paymentMethod?: string;
  /** External transaction reference from the bank or gateway. */
  transactionId?: string;
  /** Cheque or internal reference number. */
  referenceNumber?: string;
  /** Name of the person or company the amount was received from. */
  receivedFrom: string;
  /** Address of the payer. */
  receivedFromAddress?: string;
  /** Tax amount included in the receipt. */
  taxAmount?: number;
  /** Tax rate applied, as a percentage. */
  taxRate?: number;
  /** Type of tax applied (e.g. `GST`). */
  taxType?: string;
  /** What the amount was received for. */
  description?: string;
  /** Free-text notes. */
  notes?: string;
  /** Id of the employee who issued the receipt. */
  issuedBy?: number;
  /** Id of the project this receipt belongs to. */
  projectId?: number;
  /** Id of the payment this receipt records. */
  paymentId?: number;
  /** Id of the invoice this receipt settles. */
  invoiceId?: number;
  /** Id of the customer the amount was received from. */
  customerId?: number;
  /** Id of the owning organization. */
  organizationId?: number;
  /** Timestamp the receipt was created (server-set). */
  createdAt: Date;
  /** Timestamp the receipt was last updated (server-set). */
  updatedAt?: Date;
}

/**
 * Parses a raw receipt payload into a typed {@link Receipt}.
 *
 * Enum fields fall back to a default member on an unknown or absent value; the
 * `receiptDate`, `createdAt` and `updatedAt` timestamps are coerced to `Date`
 * (naive ISO strings are treated as UTC), and money is coerced from a possibly
 * string-serialized BigDecimal to a number.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Receipt`.
 * @throws {TypeError} If `id` is missing or not a positive integer.
 */
export function parseReceipt(json: unknown): Receipt {
  const raw = ReceiptSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseReceipt.id'),
    receiptNumber: raw.receiptNumber ?? '',
    type: parseReceiptType(raw.type),
    status: parseReceiptStatus(raw.status),
    amount: raw.amount ?? 0,
    currency: raw.currency ?? 'INR',
    receiptDate: parseUTCDate(raw.receiptDate) ?? undefined,
    paymentMethod: raw.paymentMethod ?? undefined,
    transactionId: raw.transactionId ?? undefined,
    referenceNumber: raw.referenceNumber ?? undefined,
    receivedFrom: raw.receivedFrom ?? '',
    receivedFromAddress: raw.receivedFromAddress ?? undefined,
    taxAmount: raw.taxAmount ?? undefined,
    taxRate: raw.taxRate ?? undefined,
    taxType: raw.taxType ?? undefined,
    description: raw.description ?? undefined,
    notes: raw.notes ?? undefined,
    issuedBy: raw.issuedBy ?? undefined,
    projectId: raw.projectId ?? undefined,
    paymentId: raw.paymentId ?? undefined,
    invoiceId: raw.invoiceId ?? undefined,
    customerId: raw.customerId ?? undefined,
    organizationId: raw.organizationId ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? new Date(),
    updatedAt: raw.updatedAt ? (parseUTCDate(raw.updatedAt) ?? undefined) : undefined,
  };
}

/**
 * Fields for creating a receipt. The receipt number is generated server-side,
 * so it is not accepted here; `amount` and `receivedFrom` are required, every
 * other field is optional.
 */
export interface CreateReceiptRequest {
  /** Kind of receipt. */
  type?: ReceiptType;
  /** Lifecycle status. */
  status?: ReceiptStatus;
  /** Amount received in the given currency. Required. */
  amount: number;
  /** Currency code for the amount (e.g. `INR`). */
  currency?: string;
  /** Date the amount was received (`YYYY-MM-DD`). */
  receiptDate?: string;
  /** How the amount was received (free text). */
  paymentMethod?: string;
  /** External transaction reference from the bank or gateway. */
  transactionId?: string;
  /** Cheque or internal reference number. */
  referenceNumber?: string;
  /** Name of the person or company the amount was received from. Required. */
  receivedFrom: string;
  /** Address of the payer. */
  receivedFromAddress?: string;
  /** Tax amount included in the receipt. */
  taxAmount?: number;
  /** Tax rate applied, as a percentage. */
  taxRate?: number;
  /** Type of tax applied (e.g. `GST`). */
  taxType?: string;
  /** What the amount was received for. */
  description?: string;
  /** Free-text notes. */
  notes?: string;
  /** Id of the employee who issued the receipt. */
  issuedBy?: number;
  /** Id of the project this receipt belongs to. */
  projectId?: number;
  /** Id of the payment this receipt records. */
  paymentId?: number;
  /** Id of the invoice this receipt settles. */
  invoiceId?: number;
  /** Id of the customer the amount was received from. */
  customerId?: number;
}

/**
 * Fields for updating a receipt. The receipt number is immutable and not
 * accepted; otherwise identical to {@link CreateReceiptRequest}.
 */
export type UpdateReceiptRequest = CreateReceiptRequest;

/**
 * Serializes the shared receipt request fields into a backend request body.
 * Required fields (`amount`, `receivedFrom`) are always emitted; optional inputs
 * only when set.
 */
function receiptRequestToJson(
  dto: CreateReceiptRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    amount: dto.amount,
    receivedFrom: dto.receivedFrom,
  };
  if (dto.type !== undefined) json.type = dto.type;
  if (dto.status !== undefined) json.status = dto.status;
  if (dto.currency !== undefined) json.currency = dto.currency;
  if (dto.receiptDate !== undefined) json.receiptDate = dto.receiptDate;
  if (dto.paymentMethod !== undefined) json.paymentMethod = dto.paymentMethod;
  if (dto.transactionId !== undefined) json.transactionId = dto.transactionId;
  if (dto.referenceNumber !== undefined)
    json.referenceNumber = dto.referenceNumber;
  if (dto.receivedFromAddress !== undefined)
    json.receivedFromAddress = dto.receivedFromAddress;
  if (dto.taxAmount !== undefined) json.taxAmount = dto.taxAmount;
  if (dto.taxRate !== undefined) json.taxRate = dto.taxRate;
  if (dto.taxType !== undefined) json.taxType = dto.taxType;
  if (dto.description !== undefined) json.description = dto.description;
  if (dto.notes !== undefined) json.notes = dto.notes;
  if (dto.issuedBy !== undefined) json.issuedBy = dto.issuedBy;
  if (dto.projectId !== undefined) json.projectId = dto.projectId;
  if (dto.paymentId !== undefined) json.paymentId = dto.paymentId;
  if (dto.invoiceId !== undefined) json.invoiceId = dto.invoiceId;
  if (dto.customerId !== undefined) json.customerId = dto.customerId;
  return json;
}

/**
 * Serializes a {@link CreateReceiptRequest} into the backend request body.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend `ReceiptCreationDto`.
 */
export function createReceiptToJson(
  dto: CreateReceiptRequest
): Record<string, unknown> {
  return receiptRequestToJson(dto);
}

/**
 * Serializes an {@link UpdateReceiptRequest} into the backend request body.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching the backend `ReceiptUpdateDto`.
 */
export function updateReceiptToJson(
  dto: UpdateReceiptRequest
): Record<string, unknown> {
  return receiptRequestToJson(dto);
}
