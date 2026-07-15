/**
 * @module types/leave/leave-balance
 *
 * The leave-balance entities — {@link LeaveBalance}, its cross-policy
 * {@link LeaveBalanceSummary}, and the ledger {@link LeaveTransaction} — plus
 * the manual-adjustment payload {@link AdjustLeaveBalanceRequest} and the
 * parsers {@link parseLeaveBalance}, {@link parseLeaveBalanceSummary}, and
 * {@link parseLeaveTransaction}.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { parsePositiveInt } from '../../lib/utils/parse-id';
import { TransactionType } from './leave-enums';

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
export function parseLeaveBalance(json: any): LeaveBalance {
  return {
    id: parsePositiveInt(json.id, 'parseLeaveBalance.id'),
    employeeId: parsePositiveInt(
      json.employeeId,
      'parseLeaveBalance.employeeId'
    ),
    leavePolicyId: parsePositiveInt(
      json.leavePolicyId ?? json.leavePolicy?.id,
      'parseLeaveBalance.leavePolicyId'
    ),
    leaveTypeName: json.leaveTypeName ?? json.leavePolicy?.leaveTypeName,
    year: json.year ?? new Date().getFullYear(),
    openingBalance: json.openingBalance ?? 0,
    accrued: json.accrued ?? 0,
    used: json.used ?? 0,
    pending: json.pending ?? 0,
    carryForwardFromPrevious: json.carryForwardFromPrevious ?? 0,
    availableBalance: json.availableBalance ?? json.available ?? 0,
    bookableBalance: json.bookableBalance ?? json.bookable ?? 0,
    lastAccrualDate:
      (json.lastAccrualDate ?? json.lastCalculatedAt)
        ? new Date(json.lastAccrualDate ?? json.lastCalculatedAt)
        : undefined,
    createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
    updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
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
export function parseLeaveBalanceSummary(json: any): LeaveBalanceSummary {
  return {
    employeeId: parsePositiveInt(
      json.employeeId,
      'parseLeaveBalanceSummary.employeeId'
    ),
    year: json.year ?? new Date().getFullYear(),
    balances: json.balances
      ? json.balances.map((b: any) => parseLeaveBalance(b))
      : [],
    totalAvailable: json.totalAvailable ?? 0,
    totalUsed: json.totalUsed ?? 0,
    totalPending: json.totalPending ?? 0,
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
export function parseLeaveTransaction(json: any): LeaveTransaction {
  return {
    id: parsePositiveInt(json.id, 'parseLeaveTransaction.id'),
    leaveBalanceId: parsePositiveInt(
      json.leaveBalanceId,
      'parseLeaveTransaction.leaveBalanceId'
    ),
    leaveTypeName: json.leaveTypeName ?? json.leaveBalance?.leaveTypeName,
    transactionType: json.transactionType ?? TransactionType.ADJUSTMENT,
    days: json.days ?? 0,
    balanceBefore: json.balanceBefore ?? 0,
    balanceAfter: json.balanceAfter ?? 0,
    leaveRequestId: json.leaveRequestId,
    reason: json.reason,
    transactionDate: json.transactionDate
      ? new Date(json.transactionDate)
      : new Date(),
    createdById: json.createdById,
    createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
  };
}
