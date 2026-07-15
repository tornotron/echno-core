/**
 * @module types/leave/leave-policy
 *
 * The {@link LeavePolicy} entity and its parser {@link parseLeavePolicy}. A
 * policy defines one leave type's quota, accrual, carry-forward, and
 * eligibility rules. See `leave-policy-create.ts` / `leave-policy-update.ts`
 * for the write payloads (re-exported here).
 */

import { parsePositiveInt } from '../../lib/utils/parse-id';

/* eslint-disable @typescript-eslint/no-explicit-any */


/** Rules governing one type of leave for an organization. */
export interface LeavePolicy {
  /** Unique surrogate identifier. */
  id: number;
  /** Owning organization. */
  organizationId: number;
  /** Short code for the leave type (e.g. `'AL'`, `'SL'`). */
  leaveTypeCode: string;
  /** Display name of the leave type. */
  leaveTypeName: string;
  /** Optional longer description of the policy. */
  description?: string;
  /** Days granted per year. */
  annualQuota: number;
  /** Days accrued per month. */
  accrualRatePerMonth: number;
  /** Maximum days that may carry forward to the next period. */
  carryForwardLimit: number;
  /** Months after which carried-forward balance expires. */
  carryForwardExpiryMonths?: number;
  /** Minimum days per single request. */
  minDaysPerRequest: number;
  /** Maximum days per single request, if capped. */
  maxDaysPerRequest?: number;
  /** Required advance-notice days before the leave start. */
  advanceNoticeDays: number;
  /** Whether supporting attachments are required. */
  requiresAttachment: boolean;
  /** Days-per-request threshold above which an attachment is required. */
  attachmentRequiredAfterDays?: number;
  /** Genders the policy applies to (e.g. `'ALL'`, `'FEMALE'`). */
  applicableGenders: string;
  /** Minimum months of service before an employee is eligible. */
  minServiceMonths: number;
  /** Whether half-day requests are allowed. */
  allowHalfDay: boolean;
  /** Whether leave under this policy is paid. */
  isPaid: boolean;
  /** Sort order for display in policy lists. */
  displayOrder: number;
  /** Whether the policy is currently active. */
  isActive: boolean;
  /** Policy creation timestamp. */
  createdAt?: Date;
  /** Policy last-modified timestamp. */
  updatedAt?: Date;
}

/**
 * Parses a raw policy payload into a typed {@link LeavePolicy}.
 *
 * Validates `id` and `organizationId` as positive ints, applies defaults for
 * absent numeric/boolean fields, and hydrates `createdAt` / `updatedAt` into
 * `Date` objects.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `LeavePolicy` domain object.
 * @throws {Error} If `id` or `organizationId` is missing or not a positive int.
 */
export function parseLeavePolicy(json: any): LeavePolicy {
  return {
    id: parsePositiveInt(json.id, 'parseLeavePolicy.id'),
    organizationId: parsePositiveInt(
      json.organizationId,
      'parseLeavePolicy.organizationId'
    ),
    leaveTypeCode: json.leaveTypeCode ?? '',
    leaveTypeName: json.leaveTypeName ?? '',
    description: json.description,
    annualQuota: json.annualQuota ?? 0,
    accrualRatePerMonth: json.accrualRatePerMonth ?? 0,
    carryForwardLimit: json.carryForwardLimit ?? 0,
    carryForwardExpiryMonths: json.carryForwardExpiryMonths,
    minDaysPerRequest: json.minDaysPerRequest ?? 0.5,
    maxDaysPerRequest: json.maxDaysPerRequest,
    advanceNoticeDays: json.advanceNoticeDays ?? 0,
    requiresAttachment: json.requiresAttachment ?? false,
    attachmentRequiredAfterDays: json.attachmentRequiredAfterDays,
    applicableGenders: json.applicableGenders ?? 'ALL',
    minServiceMonths: json.minServiceMonths ?? 0,
    allowHalfDay: json.allowHalfDay ?? true,
    isPaid: json.isPaid ?? true,
    displayOrder: json.displayOrder ?? 0,
    isActive: json.isActive ?? true,
    createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
    updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
  };
}

export {
  type CreateLeavePolicyRequest,
  createLeavePolicyToJson,
} from './leave-policy-create';
export {
  type UpdateLeavePolicyRequest,
  updateLeavePolicyToJson,
} from './leave-policy-update';
