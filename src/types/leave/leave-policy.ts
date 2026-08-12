/**
 * @module types/leave/leave-policy
 *
 * The {@link LeavePolicy} entity and its parser {@link parseLeavePolicy}. A
 * policy defines one leave type's quota, accrual, carry-forward, and
 * eligibility rules. See `leave-policy-create.ts` / `leave-policy-update.ts`
 * for the write payloads (re-exported here).
 */

import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import {
  backendDate,
  nullableBoolean,
  nullableNumber,
  nullableString,
  opaque,
} from '../../lib/validation/backend-schema';

const LeavePolicyResponseSchema = z.object({
  id: opaque,
  organizationId: opaque,
  leaveTypeCode: nullableString,
  leaveTypeName: nullableString,
  description: nullableString,
  annualQuota: nullableNumber,
  accrualRatePerMonth: nullableNumber,
  carryForwardLimit: nullableNumber,
  carryForwardExpiryMonths: nullableNumber,
  minDaysPerRequest: nullableNumber,
  maxDaysPerRequest: nullableNumber,
  advanceNoticeDays: nullableNumber,
  requiresAttachment: nullableBoolean,
  attachmentRequiredAfterDays: nullableNumber,
  applicableGenders: nullableString,
  minServiceMonths: nullableNumber,
  allowHalfDay: nullableBoolean,
  isPaid: nullableBoolean,
  displayOrder: nullableNumber,
  isActive: nullableBoolean,
  createdAt: backendDate,
  updatedAt: backendDate,
});

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
export function parseLeavePolicy(json: unknown): LeavePolicy {
  const raw = LeavePolicyResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseLeavePolicy.id'),
    organizationId: parsePositiveInt(
      raw.organizationId,
      'parseLeavePolicy.organizationId'
    ),
    leaveTypeCode: raw.leaveTypeCode ?? '',
    leaveTypeName: raw.leaveTypeName ?? '',
    description: raw.description ?? undefined,
    annualQuota: raw.annualQuota ?? 0,
    accrualRatePerMonth: raw.accrualRatePerMonth ?? 0,
    carryForwardLimit: raw.carryForwardLimit ?? 0,
    carryForwardExpiryMonths: raw.carryForwardExpiryMonths ?? undefined,
    minDaysPerRequest: raw.minDaysPerRequest ?? 0.5,
    maxDaysPerRequest: raw.maxDaysPerRequest ?? undefined,
    advanceNoticeDays: raw.advanceNoticeDays ?? 0,
    requiresAttachment: raw.requiresAttachment ?? false,
    attachmentRequiredAfterDays: raw.attachmentRequiredAfterDays ?? undefined,
    applicableGenders: raw.applicableGenders ?? 'ALL',
    minServiceMonths: raw.minServiceMonths ?? 0,
    allowHalfDay: raw.allowHalfDay ?? true,
    isPaid: raw.isPaid ?? true,
    displayOrder: raw.displayOrder ?? 0,
    isActive: raw.isActive ?? true,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    updatedAt: parseUTCDate(raw.updatedAt) ?? undefined,
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
