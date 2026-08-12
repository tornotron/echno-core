/**
 * @module types/leave/leave-request
 *
 * The {@link LeaveRequest} entity, its parser {@link parseLeaveRequest}, and
 * the request/response shapes for day calculation ({@link CalculateDays},
 * {@link CalculateDaysResponse}) and conflict checks
 * ({@link ConflictCheckResponse}). See `leave-request-create.ts` /
 * `leave-request-update.ts` for the write payloads (re-exported here).
 */

import { z } from 'zod';
import { LeaveStatus, HalfDayType } from './leave-enums';
import { LeaveApproval, parseLeaveApproval } from './leave-approval';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import {
  backendDate,
  nullableNumber,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

const LeaveRequestResponseSchema = z.object({
  id: opaque,
  requestNumber: nullableString,
  employeeId: opaque,
  employeeName: nullableString,
  department: nullableString,
  organizationId: optionalNumericId,
  leavePolicyId: opaque,
  leavePolicy: z
    .object({ id: opaque, leaveTypeName: nullableString })
    .nullish(),
  leaveTypeName: nullableString,
  startDate: backendDate,
  startHalfDayType: nullableString,
  endDate: backendDate,
  endHalfDayType: nullableString,
  totalDays: nullableNumber,
  reason: nullableString,
  contactDuringLeave: nullableString,
  handoverToId: optionalNumericId,
  handoverToName: nullableString,
  handoverTo: z.object({ name: nullableString }).nullish(),
  handoverNotes: nullableString,
  status: nullableString,
  currentApproverId: optionalNumericId,
  currentApproverName: nullableString,
  currentApprovalLevel: nullableNumber,
  maxApprovalLevel: nullableNumber,
  cancellationReason: nullableString,
  approvals: z.array(z.unknown()).nullish(),
  createdAt: backendDate,
  updatedAt: backendDate,
  submittedAt: backendDate,
  approvedAt: backendDate,
  rejectedAt: backendDate,
  cancelledAt: backendDate,
  withdrawnAt: backendDate,
});

/** An employee's request for leave over a date range. */
export interface LeaveRequest {
  /** Unique surrogate identifier. */
  id: number;
  /** Human-facing request reference number. */
  requestNumber: string;
  /** Employee the request belongs to. */
  employeeId: number;
  /** Denormalized employee display name. */
  employeeName?: string;
  /** Denormalized department name. */
  department?: string;
  /** Owning organization. */
  organizationId?: number;
  /** Policy the request is filed under. */
  leavePolicyId: number;
  /** Denormalized leave-type display name. */
  leaveTypeName?: string;
  /** First day of leave. */
  startDate: Date;
  /** Half-day type applied to the start day. */
  startHalfDayType?: HalfDayType;
  /** Last day of leave. */
  endDate: Date;
  /** Half-day type applied to the end day. */
  endHalfDayType?: HalfDayType;
  /** Total leave days requested (accounts for half-days). */
  totalDays: number;
  /** Reason for the request. */
  reason: string;
  /** How to reach the employee during leave. */
  contactDuringLeave?: string;
  /** Employee taking over the requester's duties. */
  handoverToId?: number;
  /** Denormalized handover employee name. */
  handoverToName?: string;
  /** Handover instructions. */
  handoverNotes?: string;
  /** Current lifecycle state. */
  status: LeaveStatus;
  /** Employee currently responsible for the pending approval. */
  currentApproverId?: number;
  /** Denormalized current-approver name. */
  currentApproverName?: string;
  /** Current step in the approval chain. */
  currentApprovalLevel?: number;
  /** Total steps in the approval chain. */
  maxApprovalLevel?: number;
  /** Reason recorded on cancellation. */
  cancellationReason?: string;
  /** Recorded approval steps, when included by the endpoint. */
  approvals?: LeaveApproval[];
  /** Record creation timestamp. */
  createdAt?: Date;
  /** Record last-modified timestamp. */
  updatedAt?: Date;
  /** When the request was submitted for approval. */
  submittedAt?: Date;
  /** When the request was approved. */
  approvedAt?: Date;
  /** When the request was rejected. */
  rejectedAt?: Date;
  /** When the request was cancelled. */
  cancelledAt?: Date;
  /** When the request was withdrawn. */
  withdrawnAt?: Date;
}

/** Input for the day-count calculation endpoint. */
export interface CalculateDays {
  /** Inclusive start date (ISO date string). */
  startDate: string;
  /** Half-day type for the start day. */
  startHalfDayType?: HalfDayType | null;
  /** Inclusive end date (ISO date string). */
  endDate: string;
  /** Half-day type for the end day. */
  endHalfDayType?: HalfDayType | null;
}

/** Result of the day-count calculation endpoint. */
export interface CalculateDaysResponse {
  /** Computed total leave days for the range. */
  totalDays: number;
}

/** Result of the leave-conflict check endpoint. */
export interface ConflictCheckResponse {
  /** Whether the proposed range conflicts with existing leave. */
  hasConflict: boolean;
  /** The conflicting requests, when any. */
  conflictingRequests: LeaveRequest[];
}

/**
 * Parses a raw leave-request payload into a typed {@link LeaveRequest}.
 *
 * Validates `id`, `employeeId`, and `leavePolicyId` as positive ints (falling
 * back to nested `leavePolicy.id` for the policy), hydrates all date fields
 * into `Date` objects, defaults `status` to `DRAFT`, and recursively parses any
 * embedded `approvals`.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `LeaveRequest` domain object.
 * @throws {Error} If `id`, `employeeId`, or the resolved policy id is missing or
 *   not a positive int.
 */
export function parseLeaveRequest(json: unknown): LeaveRequest {
  const raw = LeaveRequestResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseLeaveRequest.id'),
    requestNumber: raw.requestNumber ?? '',
    employeeId: parsePositiveInt(
      raw.employeeId,
      'parseLeaveRequest.employeeId'
    ),
    employeeName: raw.employeeName ?? undefined,
    department: raw.department ?? undefined,
    organizationId: raw.organizationId ?? undefined,
    leavePolicyId: parsePositiveInt(
      raw.leavePolicyId ?? raw.leavePolicy?.id,
      'parseLeaveRequest.leavePolicyId'
    ),
    leaveTypeName:
      raw.leaveTypeName ?? raw.leavePolicy?.leaveTypeName ?? undefined,
    startDate: parseUTCDate(raw.startDate) ?? new Date(),
    startHalfDayType: raw.startHalfDayType as HalfDayType,
    endDate: parseUTCDate(raw.endDate) ?? new Date(),
    endHalfDayType: raw.endHalfDayType as HalfDayType,
    totalDays: raw.totalDays ?? 0,
    reason: raw.reason ?? '',
    contactDuringLeave: raw.contactDuringLeave ?? undefined,
    handoverToId: raw.handoverToId ?? undefined,
    handoverToName: raw.handoverToName ?? raw.handoverTo?.name ?? undefined,
    handoverNotes: raw.handoverNotes ?? undefined,
    status: (raw.status as LeaveStatus) ?? LeaveStatus.DRAFT,
    currentApproverId: raw.currentApproverId ?? undefined,
    currentApproverName: raw.currentApproverName ?? undefined,
    currentApprovalLevel: raw.currentApprovalLevel ?? undefined,
    maxApprovalLevel: raw.maxApprovalLevel ?? undefined,
    cancellationReason: raw.cancellationReason ?? undefined,
    approvals: raw.approvals
      ? raw.approvals.map((approval) => parseLeaveApproval(approval))
      : undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    updatedAt: parseUTCDate(raw.updatedAt) ?? undefined,
    submittedAt: parseUTCDate(raw.submittedAt) ?? undefined,
    approvedAt: parseUTCDate(raw.approvedAt) ?? undefined,
    rejectedAt: parseUTCDate(raw.rejectedAt) ?? undefined,
    cancelledAt: parseUTCDate(raw.cancelledAt) ?? undefined,
    withdrawnAt: parseUTCDate(raw.withdrawnAt) ?? undefined,
  };
}

export {
  type CreateLeaveRequestRequest,
  createLeaveRequestToJson,
} from './leave-request-create';
export {
  type UpdateLeaveRequestRequest,
  updateLeaveRequestToJson,
} from './leave-request-update';
