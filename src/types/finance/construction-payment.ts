/**
 * @module types/finance/construction-payment
 *
 * The {@link ConstructionPayment} entity (an outgoing construction payment
 * voucher, backend `ConstructionPaymentDto`), plus its parser, the four payment
 * enums, and the create / update request payloads with their serializers.
 *
 * Foreign references (project, purchase order, vendor, employee, sub-contract,
 * labour, verifier) are numeric surrogate ids; the voucher's own primary key
 * and its optional invoice link are UUID strings. The amount is a BigDecimal the
 * backend may serialize as a string, coerced to a number at the boundary.
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

/** Nature of a construction payment voucher. */
export enum ConstructionPaymentType {
  INVOICE = 'INVOICE',
  ADVANCE = 'ADVANCE',
  REFUND = 'REFUND',
  EXPENSE = 'EXPENSE',
  SALARY = 'SALARY',
  OTHER = 'OTHER',
}

/** Processing status of a construction payment voucher. */
export enum ConstructionPaymentVoucherStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

/** Instrument used to make the payment. */
export enum ConstructionPaymentMethod {
  CASH = 'CASH',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
  UPI = 'UPI',
  CARD = 'CARD',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  IMPS = 'IMPS',
  OTHER = 'OTHER',
}

/** Category of the party being paid. */
export enum ConstructionPayeeType {
  EMPLOYEE = 'EMPLOYEE',
  VENDOR = 'VENDOR',
  SUB_CONTRACTOR = 'SUB_CONTRACTOR',
  LABOUR = 'LABOUR',
  CONSULTANT = 'CONSULTANT',
  UTILITY = 'UTILITY',
  GOVERNMENT = 'GOVERNMENT',
  INSURANCE = 'INSURANCE',
  BANK = 'BANK',
  LEGAL = 'LEGAL',
  RENTAL = 'RENTAL',
  OTHER = 'OTHER',
}

/**
 * Narrows an untyped backend string to {@link ConstructionPaymentType},
 * defaulting to `OTHER` when the value is absent or unrecognized.
 */
export function parseConstructionPaymentType(
  raw: unknown
): ConstructionPaymentType {
  return typeof raw === 'string' &&
    (Object.values(ConstructionPaymentType) as string[]).includes(raw)
    ? (raw as ConstructionPaymentType)
    : ConstructionPaymentType.OTHER;
}

/**
 * Narrows an untyped backend string to {@link ConstructionPaymentVoucherStatus},
 * defaulting to `PENDING` when the value is absent or unrecognized (a new
 * voucher starts pending).
 */
export function parseConstructionPaymentVoucherStatus(
  raw: unknown
): ConstructionPaymentVoucherStatus {
  return typeof raw === 'string' &&
    (Object.values(ConstructionPaymentVoucherStatus) as string[]).includes(raw)
    ? (raw as ConstructionPaymentVoucherStatus)
    : ConstructionPaymentVoucherStatus.PENDING;
}

/**
 * Narrows an untyped backend string to {@link ConstructionPaymentMethod},
 * defaulting to `OTHER` when the value is absent or unrecognized.
 */
export function parseConstructionPaymentMethod(
  raw: unknown
): ConstructionPaymentMethod {
  return typeof raw === 'string' &&
    (Object.values(ConstructionPaymentMethod) as string[]).includes(raw)
    ? (raw as ConstructionPaymentMethod)
    : ConstructionPaymentMethod.OTHER;
}

/**
 * Narrows an untyped backend string to {@link ConstructionPayeeType},
 * defaulting to `OTHER` when the value is absent or unrecognized.
 */
export function parseConstructionPayeeType(
  raw: unknown
): ConstructionPayeeType {
  return typeof raw === 'string' &&
    (Object.values(ConstructionPayeeType) as string[]).includes(raw)
    ? (raw as ConstructionPayeeType)
    : ConstructionPayeeType.OTHER;
}

const ConstructionPaymentSchema = z.object({
  id: z.string().nullish(),
  paymentNumber: nullableString,
  type: opaque,
  status: opaque,
  method: opaque,
  payeeType: opaque,
  projectId: numericId,
  invoiceId: nullableString,
  purchaseOrderId: optionalNumericId,
  vendorId: optionalNumericId,
  employeeId: optionalNumericId,
  subContractId: optionalNumericId,
  labourId: optionalNumericId,
  payeeName: nullableString,
  payeeDetails: nullableString,
  amount: money,
  currency: nullableString,
  paymentDate: backendDate,
  transactionId: nullableString,
  referenceNumber: nullableString,
  bankName: nullableString,
  accountNumber: nullableString,
  ifscCode: nullableString,
  verifiedBy: optionalNumericId,
  verifiedAt: backendDate,
  description: nullableString,
  notes: nullableString,
});

/** An outgoing construction payment voucher. */
export interface ConstructionPayment {
  /** UUID primary key. */
  id: string;
  /** Human-facing payment number. */
  paymentNumber: string;
  /** Voucher nature. */
  type: ConstructionPaymentType;
  /** Processing status. */
  status: ConstructionPaymentVoucherStatus;
  /** Payment instrument. */
  method: ConstructionPaymentMethod;
  /** Category of the payee. */
  payeeType: ConstructionPayeeType;
  /** Project the payment belongs to. */
  projectId: number;
  /** Linked construction invoice (UUID). */
  invoiceId?: string;
  /** Linked purchase order id. */
  purchaseOrderId?: number;
  /** Vendor id. */
  vendorId?: number;
  /** Employee id. */
  employeeId?: number;
  /** Sub-contract id. */
  subContractId?: number;
  /** Labour id. */
  labourId?: number;
  /** Payee name (free text). */
  payeeName?: string;
  /** Payee details (free text). */
  payeeDetails?: string;
  /** Amount paid. */
  amount: number;
  /** Currency code. */
  currency?: string;
  /** Payment date (`YYYY-MM-DD`). */
  paymentDate?: string;
  /** External transaction id. */
  transactionId?: string;
  /** Reference number (e.g. UTR / cheque number). */
  referenceNumber?: string;
  /** Bank name. */
  bankName?: string;
  /** Account number. */
  accountNumber?: string;
  /** IFSC code. */
  ifscCode?: string;
  /** User who verified the voucher. */
  verifiedBy?: number;
  /** Verification timestamp (ISO instant). */
  verifiedAt?: string;
  /** Description (free text). */
  description?: string;
  /** Free-text notes. */
  notes?: string;
}

/**
 * Parses a raw construction-payment payload into a typed
 * {@link ConstructionPayment}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `ConstructionPayment`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseConstructionPayment(json: unknown): ConstructionPayment {
  const raw = ConstructionPaymentSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseConstructionPayment.id'),
    paymentNumber: raw.paymentNumber ?? '',
    type: parseConstructionPaymentType(raw.type),
    status: parseConstructionPaymentVoucherStatus(raw.status),
    method: parseConstructionPaymentMethod(raw.method),
    payeeType: parseConstructionPayeeType(raw.payeeType),
    projectId: raw.projectId,
    invoiceId: raw.invoiceId ?? undefined,
    purchaseOrderId: raw.purchaseOrderId ?? undefined,
    vendorId: raw.vendorId ?? undefined,
    employeeId: raw.employeeId ?? undefined,
    subContractId: raw.subContractId ?? undefined,
    labourId: raw.labourId ?? undefined,
    payeeName: raw.payeeName ?? undefined,
    payeeDetails: raw.payeeDetails ?? undefined,
    amount: raw.amount ?? 0,
    currency: raw.currency ?? undefined,
    paymentDate: raw.paymentDate ?? undefined,
    transactionId: raw.transactionId ?? undefined,
    referenceNumber: raw.referenceNumber ?? undefined,
    bankName: raw.bankName ?? undefined,
    accountNumber: raw.accountNumber ?? undefined,
    ifscCode: raw.ifscCode ?? undefined,
    verifiedBy: raw.verifiedBy ?? undefined,
    verifiedAt: raw.verifiedAt ?? undefined,
    description: raw.description ?? undefined,
    notes: raw.notes ?? undefined,
  };
}

/**
 * Fields for creating a construction payment voucher. The status is not
 * accepted here: a new voucher always starts `PENDING`.
 */
export interface CreateConstructionPaymentRequest {
  /** Voucher nature. Required. */
  type: ConstructionPaymentType;
  /** Payment instrument. Required. */
  method: ConstructionPaymentMethod;
  /** Category of the payee. */
  payeeType?: ConstructionPayeeType;
  /** Project the payment belongs to. Required. */
  projectId: number;
  /** Linked construction invoice (UUID). */
  invoiceId?: string;
  /** Linked purchase order id. */
  purchaseOrderId?: number;
  /** Vendor id. */
  vendorId?: number;
  /** Employee id. */
  employeeId?: number;
  /** Sub-contract id. */
  subContractId?: number;
  /** Labour id. */
  labourId?: number;
  /** Payee name (max 200). */
  payeeName?: string;
  /** Payee details (max 500). */
  payeeDetails?: string;
  /** Amount paid (> 0). Required. */
  amount: number;
  /** Currency code (max 10). */
  currency?: string;
  /** Payment date (`YYYY-MM-DD`). Required. */
  paymentDate: string;
  /** External transaction id (max 100). */
  transactionId?: string;
  /** Reference number (max 100). */
  referenceNumber?: string;
  /** Bank name (max 100). */
  bankName?: string;
  /** Account number (max 50). */
  accountNumber?: string;
  /** IFSC code (max 20). */
  ifscCode?: string;
  /** User who verified the voucher. */
  verifiedBy?: number;
  /** Verification timestamp (ISO instant). */
  verifiedAt?: string;
  /** Description (max 1000). */
  description?: string;
  /** Free-text notes (max 1000). */
  notes?: string;
}

/**
 * Fields for updating a construction payment voucher (full replacement). The
 * status is set directly.
 */
export interface UpdateConstructionPaymentRequest {
  /** Voucher nature. Required. */
  type: ConstructionPaymentType;
  /** Processing status. Required. */
  status: ConstructionPaymentVoucherStatus;
  /** Payment instrument. Required. */
  method: ConstructionPaymentMethod;
  /** Category of the payee. */
  payeeType?: ConstructionPayeeType;
  /** Project the payment belongs to. Required. */
  projectId: number;
  /** Linked construction invoice (UUID). */
  invoiceId?: string;
  /** Linked purchase order id. */
  purchaseOrderId?: number;
  /** Vendor id. */
  vendorId?: number;
  /** Employee id. */
  employeeId?: number;
  /** Sub-contract id. */
  subContractId?: number;
  /** Labour id. */
  labourId?: number;
  /** Payee name (max 200). */
  payeeName?: string;
  /** Payee details (max 500). */
  payeeDetails?: string;
  /** Amount paid (> 0). Required. */
  amount: number;
  /** Currency code (max 10). */
  currency?: string;
  /** Payment date (`YYYY-MM-DD`). Required. */
  paymentDate: string;
  /** External transaction id (max 100). */
  transactionId?: string;
  /** Reference number (max 100). */
  referenceNumber?: string;
  /** Bank name (max 100). */
  bankName?: string;
  /** Account number (max 50). */
  accountNumber?: string;
  /** IFSC code (max 20). */
  ifscCode?: string;
  /** User who verified the voucher. */
  verifiedBy?: number;
  /** Verification timestamp (ISO instant). */
  verifiedAt?: string;
  /** Description (max 1000). */
  description?: string;
  /** Free-text notes (max 1000). */
  notes?: string;
}

/**
 * Emits the payee, reference and optional fields shared by the create and
 * update payment bodies onto `json`. Only fields that are set are written.
 */
function appendConstructionPaymentOptionalFields(
  json: Record<string, unknown>,
  dto: CreateConstructionPaymentRequest | UpdateConstructionPaymentRequest
): void {
  if (dto.payeeType !== undefined) json.payeeType = dto.payeeType;
  if (dto.invoiceId !== undefined) json.invoiceId = dto.invoiceId;
  if (dto.purchaseOrderId !== undefined)
    json.purchaseOrderId = dto.purchaseOrderId;
  if (dto.vendorId !== undefined) json.vendorId = dto.vendorId;
  if (dto.employeeId !== undefined) json.employeeId = dto.employeeId;
  if (dto.subContractId !== undefined) json.subContractId = dto.subContractId;
  if (dto.labourId !== undefined) json.labourId = dto.labourId;
  if (dto.payeeName !== undefined) json.payeeName = dto.payeeName;
  if (dto.payeeDetails !== undefined) json.payeeDetails = dto.payeeDetails;
  if (dto.currency !== undefined) json.currency = dto.currency;
  if (dto.transactionId !== undefined) json.transactionId = dto.transactionId;
  if (dto.referenceNumber !== undefined)
    json.referenceNumber = dto.referenceNumber;
  if (dto.bankName !== undefined) json.bankName = dto.bankName;
  if (dto.accountNumber !== undefined) json.accountNumber = dto.accountNumber;
  if (dto.ifscCode !== undefined) json.ifscCode = dto.ifscCode;
  if (dto.verifiedBy !== undefined) json.verifiedBy = dto.verifiedBy;
  if (dto.verifiedAt !== undefined) json.verifiedAt = dto.verifiedAt;
  if (dto.description !== undefined) json.description = dto.description;
  if (dto.notes !== undefined) json.notes = dto.notes;
}

/**
 * Serializes a {@link CreateConstructionPaymentRequest} into the backend
 * request body.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching `CreateConstructionPaymentRequest`.
 */
export function createConstructionPaymentToJson(
  dto: CreateConstructionPaymentRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    type: dto.type,
    method: dto.method,
    projectId: dto.projectId,
    amount: dto.amount,
    paymentDate: dto.paymentDate,
  };
  appendConstructionPaymentOptionalFields(json, dto);
  return json;
}

/**
 * Serializes an {@link UpdateConstructionPaymentRequest} into the backend
 * request body.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching `UpdateConstructionPaymentRequest`.
 */
export function updateConstructionPaymentToJson(
  dto: UpdateConstructionPaymentRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    type: dto.type,
    status: dto.status,
    method: dto.method,
    projectId: dto.projectId,
    amount: dto.amount,
    paymentDate: dto.paymentDate,
  };
  appendConstructionPaymentOptionalFields(json, dto);
  return json;
}
