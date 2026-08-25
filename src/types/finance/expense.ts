/**
 * @module types/finance/expense
 *
 * The {@link Expense} entity (backend `ExpenseDto`), its parser, the expense
 * enums, and the create / update request payloads with their serializers.
 *
 * An expense records money spent against a project or the organization
 * (materials, labour, equipment, transport, and the like). Unlike the
 * UUID-keyed general-ledger entities, the expense keys its own primary key and
 * every foreign reference (project, vendor, employee, invoice, payment, budget)
 * by the numeric surrogate ids used across the operational modules. Type,
 * category and status are stored as plain lowercase strings on the backend; the
 * parser narrows them to the enums below, defaulting an unknown or absent value
 * to a sensible member. The expense number is generated server-side and is not
 * accepted on create or update.
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

/** Nature of an expense against the project cost. */
export enum ExpenseType {
  direct = 'direct',
  indirect = 'indirect',
  capital = 'capital',
  operational = 'operational',
}

/** Spend category of an expense. */
export enum ExpenseCategory {
  materials = 'materials',
  labour = 'labour',
  equipment = 'equipment',
  transport = 'transport',
  utilities = 'utilities',
  rent = 'rent',
  salaries = 'salaries',
  maintenance = 'maintenance',
  insurance = 'insurance',
  legal = 'legal',
  marketing = 'marketing',
  office = 'office',
  travel = 'travel',
  miscellaneous = 'miscellaneous',
  other = 'other',
}

/** Lifecycle status of an expense. */
export enum ExpenseStatus {
  draft = 'draft',
  pending = 'pending',
  approved = 'approved',
  rejected = 'rejected',
  paid = 'paid',
  reimbursed = 'reimbursed',
  cancelled = 'cancelled',
}

/**
 * Narrows an untyped backend string to {@link ExpenseType}, defaulting to
 * `direct` when the value is absent or unrecognized.
 */
export function parseExpenseType(raw: unknown): ExpenseType {
  return typeof raw === 'string' &&
    (Object.values(ExpenseType) as string[]).includes(raw)
    ? (raw as ExpenseType)
    : ExpenseType.direct;
}

/**
 * Narrows an untyped backend string to {@link ExpenseCategory}, defaulting to
 * `other` when the value is absent or unrecognized.
 */
export function parseExpenseCategory(raw: unknown): ExpenseCategory {
  return typeof raw === 'string' &&
    (Object.values(ExpenseCategory) as string[]).includes(raw)
    ? (raw as ExpenseCategory)
    : ExpenseCategory.other;
}

/**
 * Narrows an untyped backend string to {@link ExpenseStatus}, defaulting to
 * `draft` when the value is absent or unrecognized.
 */
export function parseExpenseStatus(raw: unknown): ExpenseStatus {
  return typeof raw === 'string' &&
    (Object.values(ExpenseStatus) as string[]).includes(raw)
    ? (raw as ExpenseStatus)
    : ExpenseStatus.draft;
}

const ExpenseSchema = z.object({
  id: numericId,
  expenseNumber: nullableString,
  type: nullableString,
  category: nullableString,
  status: nullableString,
  description: nullableString,
  amount: money,
  currency: nullableString,
  expenseDate: backendDate,
  paymentMethod: nullableString,
  notes: nullableString,
  projectId: optionalNumericId,
  vendorId: optionalNumericId,
  employeeId: optionalNumericId,
  invoiceId: optionalNumericId,
  paymentId: optionalNumericId,
  budgetId: optionalNumericId,
  organizationId: optionalNumericId,
  createdAt: backendDate,
  updatedAt: backendDate,
});

/** A recorded expense against a project or the organization. */
export interface Expense {
  /** Numeric surrogate primary key. */
  id: number;
  /** Server-generated expense number (e.g. `EXP-2027-000001`). */
  expenseNumber: string;
  /** Nature of the expense against the project cost. */
  type: ExpenseType;
  /** Spend category. */
  category: ExpenseCategory;
  /** Lifecycle status. */
  status: ExpenseStatus;
  /** What the expense was for. */
  description: string;
  /** Expense amount in {@link currency}. */
  amount: number;
  /** Currency code for the amount (e.g. `INR`). */
  currency: string;
  /** Date the expense was incurred. */
  expenseDate?: Date;
  /** How the expense was paid (free text). */
  paymentMethod?: string;
  /** Free-text notes. */
  notes?: string;
  /** Id of the project this expense belongs to. */
  projectId?: number;
  /** Id of the vendor the expense was paid to. */
  vendorId?: number;
  /** Id of the employee who incurred the expense. */
  employeeId?: number;
  /** Id of the invoice this expense settles. */
  invoiceId?: number;
  /** Id of the payment that cleared the expense. */
  paymentId?: number;
  /** Id of the budget head the expense draws down. */
  budgetId?: number;
  /** Id of the owning organization. */
  organizationId?: number;
  /** Timestamp the expense was created (server-set). */
  createdAt: Date;
  /** Timestamp the expense was last updated (server-set). */
  updatedAt?: Date;
}

/**
 * Parses a raw expense payload into a typed {@link Expense}.
 *
 * Enum fields fall back to a default member on an unknown or absent value; the
 * `expenseDate`, `createdAt` and `updatedAt` timestamps are coerced to `Date`
 * (naive ISO strings are treated as UTC), and money is coerced from a possibly
 * string-serialized BigDecimal to a number.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Expense`.
 * @throws {TypeError} If `id` is missing or not a positive integer.
 */
export function parseExpense(json: unknown): Expense {
  const raw = ExpenseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseExpense.id'),
    expenseNumber: raw.expenseNumber ?? '',
    type: parseExpenseType(raw.type),
    category: parseExpenseCategory(raw.category),
    status: parseExpenseStatus(raw.status),
    description: raw.description ?? '',
    amount: raw.amount ?? 0,
    currency: raw.currency ?? 'INR',
    expenseDate: parseUTCDate(raw.expenseDate) ?? undefined,
    paymentMethod: raw.paymentMethod ?? undefined,
    notes: raw.notes ?? undefined,
    projectId: raw.projectId ?? undefined,
    vendorId: raw.vendorId ?? undefined,
    employeeId: raw.employeeId ?? undefined,
    invoiceId: raw.invoiceId ?? undefined,
    paymentId: raw.paymentId ?? undefined,
    budgetId: raw.budgetId ?? undefined,
    organizationId: raw.organizationId ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? new Date(),
    updatedAt: raw.updatedAt ? (parseUTCDate(raw.updatedAt) ?? undefined) : undefined,
  };
}

/**
 * Fields for creating an expense. The expense number is generated server-side,
 * so it is not accepted here; `description` and `amount` are required, every
 * other field is optional.
 */
export interface CreateExpenseRequest {
  /** Nature of the expense against the project cost. */
  type?: ExpenseType;
  /** Spend category. */
  category?: ExpenseCategory;
  /** Lifecycle status. */
  status?: ExpenseStatus;
  /** What the expense was for. Required. */
  description: string;
  /** Expense amount in the given currency. Required. */
  amount: number;
  /** Currency code for the amount (e.g. `INR`). */
  currency?: string;
  /** Date the expense was incurred (`YYYY-MM-DD`). */
  expenseDate?: string;
  /** How the expense was paid (free text). */
  paymentMethod?: string;
  /** Free-text notes. */
  notes?: string;
  /** Id of the project this expense belongs to. */
  projectId?: number;
  /** Id of the vendor the expense was paid to. */
  vendorId?: number;
  /** Id of the employee who incurred the expense. */
  employeeId?: number;
  /** Id of the invoice this expense settles. */
  invoiceId?: number;
  /** Id of the payment that cleared the expense. */
  paymentId?: number;
  /** Id of the budget head the expense draws down. */
  budgetId?: number;
}

/**
 * Fields for updating an expense. The expense number is immutable and not
 * accepted; otherwise identical to {@link CreateExpenseRequest}.
 */
export type UpdateExpenseRequest = CreateExpenseRequest;

/**
 * Serializes the shared expense request fields into a backend request body.
 * Required fields (`description`, `amount`) are always emitted; optional inputs
 * only when set.
 */
function expenseRequestToJson(
  dto: CreateExpenseRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    description: dto.description,
    amount: dto.amount,
  };
  if (dto.type !== undefined) json.type = dto.type;
  if (dto.category !== undefined) json.category = dto.category;
  if (dto.status !== undefined) json.status = dto.status;
  if (dto.currency !== undefined) json.currency = dto.currency;
  if (dto.expenseDate !== undefined) json.expenseDate = dto.expenseDate;
  if (dto.paymentMethod !== undefined) json.paymentMethod = dto.paymentMethod;
  if (dto.notes !== undefined) json.notes = dto.notes;
  if (dto.projectId !== undefined) json.projectId = dto.projectId;
  if (dto.vendorId !== undefined) json.vendorId = dto.vendorId;
  if (dto.employeeId !== undefined) json.employeeId = dto.employeeId;
  if (dto.invoiceId !== undefined) json.invoiceId = dto.invoiceId;
  if (dto.paymentId !== undefined) json.paymentId = dto.paymentId;
  if (dto.budgetId !== undefined) json.budgetId = dto.budgetId;
  return json;
}

/**
 * Serializes a {@link CreateExpenseRequest} into the backend request body.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend `ExpenseCreationDto`.
 */
export function createExpenseToJson(
  dto: CreateExpenseRequest
): Record<string, unknown> {
  return expenseRequestToJson(dto);
}

/**
 * Serializes an {@link UpdateExpenseRequest} into the backend request body.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching the backend `ExpenseUpdateDto`.
 */
export function updateExpenseToJson(
  dto: UpdateExpenseRequest
): Record<string, unknown> {
  return expenseRequestToJson(dto);
}
