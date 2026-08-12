/**
 * @module types/leave/leave-balance
 *
 * The leave-balance entities — {@link LeaveBalance}, its cross-policy
 * {@link LeaveBalanceSummary}, and the ledger {@link LeaveTransaction} — plus
 * the manual-adjustment payload {@link AdjustLeaveBalanceRequest} and the
 * parsers {@link parseLeaveBalance}, {@link parseLeaveBalanceSummary}, and
 * {@link parseLeaveTransaction}.
 */

import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { TransactionType } from './leave-enums';
import {
  backendDate,
  nullableNumber,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

const LeaveBalanceResponseSchema = z.object({
  id: opaque,
  employeeId: opaque,
  leavePolicyId: opaque,
  leavePolicy: z
    .object({ id: opaque, leaveTypeName: nullableString })
    .nullish(),
  leaveTypeName: nullableString,
  year: nullableNumber,
  openingBalance: nullableNumber,
  accrued: nullableNumber,
  used: nullableNumber,
  pending: nullableNumber,
  carryForwardFromPrevious: nullableNumber,
  availableBalance: nullableNumber,
  available: nullableNumber,
  bookableBalance: nullableNumber,
  bookable: nullableNumber,
  lastAccrualDate: backendDate,
  lastCalculatedAt: backendDate,
  createdAt: backendDate,
  updatedAt: backendDate,
});

const LeaveBalanceSummaryResponseSchema = z.object({
  employeeId: opaque,
  year: nullableNumber,
  balances: z.array(z.unknown()).nullish(),
  totalAvailable: nullableNumber,
  totalUsed: nullableNumber,
  totalPending: nullableNumber,
});

const LeaveTransactionResponseSchema = z.object({
  id: opaque,
  leaveBalanceId: opaque,
  leaveBalance: z.object({ leaveTypeName: nullableString }).nullish(),
  leaveTypeName: nullableString,
  transactionType: nullableString,
  days: nullableNumber,
  balanceBefore: nullableNumber,
  balanceAfter: nullableNumber,
  leaveRequestId: optionalNumericId,
  reason: nullableString,
  transactionDate: backendDate,
  createdById: optionalNumericId,
  createdAt: backendDate,
});

/** An employee's balance under one leave policy for one year. */
export interface LeaveBalance {
  /** Unique surrogate identifier. */
  id: number;
  /** Employee the balance belongs to. */
  employeeId: number;
  /** Policy the balance is tracked against. */
  leavePolicyId: number;
  /** Denormalized leave-type display name. */
  leaveTypeName?: string;
  /** Accrual year the balance covers. */
  year: number;
  /** Balance at the start of the year. */
  openingBalance: number;
  /** Days accrued so far this year. */
  accrued: number;
  /** Days already taken. */
  used: number;
  /** Days reserved by pending requests. */
  pending: number;
  /** Days carried forward from the previous year. */
  carryForwardFromPrevious: number;
  /** Days currently available (accrued minus used). */
  availableBalance: number;
  /** Days that can still be booked (available minus pending). */
  bookableBalance: number;
  /** When accrual was last applied. */
  lastAccrualDate?: Date;
  /** Record creation timestamp. */
  createdAt?: Date;
  /** Record last-modified timestamp. */
  updatedAt?: Date;
}

/** Cross-policy roll-up of an employee's balances for a year. */
export interface LeaveBalanceSummary {
  /** Employee the summary covers. */
  employeeId: number;
  /** Accrual year the summary covers. */
  year: number;
  /** The per-policy balances included. */
  balances: LeaveBalance[];
  /** Total available days across all policies. */
  totalAvailable: number;
  /** Total used days across all policies. */
  totalUsed: number;
  /** Total pending days across all policies. */
  totalPending: number;
}

/** A single entry in a leave balance's ledger. */
export interface LeaveTransaction {
  /** Unique surrogate identifier. */
  id: number;
  /** Balance this entry belongs to. */
  leaveBalanceId: number;
  /** Denormalized leave-type display name. */
  leaveTypeName?: string;
  /** Category of the ledger entry. */
  transactionType: TransactionType;
  /** Signed day delta applied by this entry. */
  days: number;
  /** Balance before the entry was applied. */
  balanceBefore: number;
  /** Balance after the entry was applied. */
  balanceAfter: number;
  /** Leave request that produced the entry, if any. */
  leaveRequestId?: number;
  /** Reason recorded for the entry. */
  reason?: string;
  /** When the entry was recorded. */
  transactionDate: Date;
  /** Employee who created the entry, if manual. */
  createdById?: number;
  /** Record creation timestamp. */
  createdAt?: Date;
}

/** Payload for a manual balance adjustment. */
export interface AdjustLeaveBalanceRequest {
  /** Employee whose balance is adjusted. */
  employeeId: number;
  /** Policy the adjustment applies to. */
  leavePolicyId: number;
  /** Signed day delta to apply. */
  days: number;
  /** Justification for the adjustment. */
  reason: string;
  /** Employee performing the adjustment. */
  adjustedById: number;
}

/**
 * Parses a raw balance payload into a typed {@link LeaveBalance}.
 *
 * Validates `id`, `employeeId`, and `leavePolicyId` as positive ints (falling
 * back to nested `leavePolicy.id`), defaults `year` to the current year and
 * absent numeric fields to `0`, and hydrates the date fields into `Date`
 * objects.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `LeaveBalance` domain object.
 * @throws {Error} If `id`, `employeeId`, or the resolved policy id is missing or
 *   not a positive int.
 */
export function parseLeaveBalance(json: unknown): LeaveBalance {
  const raw = LeaveBalanceResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseLeaveBalance.id'),
    employeeId: parsePositiveInt(
      raw.employeeId,
      'parseLeaveBalance.employeeId'
    ),
    leavePolicyId: parsePositiveInt(
      raw.leavePolicyId ?? raw.leavePolicy?.id,
      'parseLeaveBalance.leavePolicyId'
    ),
    leaveTypeName:
      raw.leaveTypeName ?? raw.leavePolicy?.leaveTypeName ?? undefined,
    year: raw.year ?? new Date().getFullYear(),
    openingBalance: raw.openingBalance ?? 0,
    accrued: raw.accrued ?? 0,
    used: raw.used ?? 0,
    pending: raw.pending ?? 0,
    carryForwardFromPrevious: raw.carryForwardFromPrevious ?? 0,
    availableBalance: raw.availableBalance ?? raw.available ?? 0,
    bookableBalance: raw.bookableBalance ?? raw.bookable ?? 0,
    lastAccrualDate:
      parseUTCDate(raw.lastAccrualDate ?? raw.lastCalculatedAt) ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    updatedAt: parseUTCDate(raw.updatedAt) ?? undefined,
  };
}

/**
 * Parses a raw summary payload into a typed {@link LeaveBalanceSummary}.
 *
 * Validates `employeeId` as a positive int, recursively parses each embedded
 * balance, and defaults absent totals to `0`.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `LeaveBalanceSummary` domain object.
 * @throws {Error} If `employeeId` is missing or not a positive int.
 */
export function parseLeaveBalanceSummary(json: unknown): LeaveBalanceSummary {
  const raw = LeaveBalanceSummaryResponseSchema.parse(json);
  return {
    employeeId: parsePositiveInt(
      raw.employeeId,
      'parseLeaveBalanceSummary.employeeId'
    ),
    year: raw.year ?? new Date().getFullYear(),
    balances: raw.balances
      ? raw.balances.map((b) => parseLeaveBalance(b))
      : [],
    totalAvailable: raw.totalAvailable ?? 0,
    totalUsed: raw.totalUsed ?? 0,
    totalPending: raw.totalPending ?? 0,
  };
}

/**
 * Parses a raw transaction payload into a typed {@link LeaveTransaction}.
 *
 * Validates `id` and `leaveBalanceId` as positive ints, defaults
 * `transactionType` to `ADJUSTMENT` and absent numeric fields to `0`, and
 * hydrates `transactionDate` (defaulting to now) and `createdAt` into `Date`
 * objects.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `LeaveTransaction` domain object.
 * @throws {Error} If `id` or `leaveBalanceId` is missing or not a positive int.
 */
export function parseLeaveTransaction(json: unknown): LeaveTransaction {
  const raw = LeaveTransactionResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseLeaveTransaction.id'),
    leaveBalanceId: parsePositiveInt(
      raw.leaveBalanceId,
      'parseLeaveTransaction.leaveBalanceId'
    ),
    leaveTypeName:
      raw.leaveTypeName ?? raw.leaveBalance?.leaveTypeName ?? undefined,
    transactionType:
      (raw.transactionType as TransactionType) ?? TransactionType.ADJUSTMENT,
    days: raw.days ?? 0,
    balanceBefore: raw.balanceBefore ?? 0,
    balanceAfter: raw.balanceAfter ?? 0,
    leaveRequestId: raw.leaveRequestId ?? undefined,
    reason: raw.reason ?? undefined,
    transactionDate: parseUTCDate(raw.transactionDate) ?? new Date(),
    createdById: raw.createdById ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
  };
}
