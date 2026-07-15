/**
 * @module types/leave/leave-request
 *
 * The {@link LeaveRequest} entity, its parser {@link parseLeaveRequest}, and
 * the request/response shapes for day calculation ({@link CalculateDays},
 * {@link CalculateDaysResponse}) and conflict checks
 * ({@link ConflictCheckResponse}). See `leave-request-create.ts` /
 * `leave-request-update.ts` for the write payloads (re-exported here).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { LeaveStatus, HalfDayType } from './leave-enums';
import { LeaveApproval, parseLeaveApproval } from './leave-approval';
import { parsePositiveInt } from '../../lib/utils/parse-id';

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
export function parseLeaveRequest(json: any): LeaveRequest {
  return {
    id: parsePositiveInt(json.id, 'parseLeaveRequest.id'),
    requestNumber: json.requestNumber ?? '',
    employeeId: parsePositiveInt(
      json.employeeId,
      'parseLeaveRequest.employeeId'
    ),
    employeeName: json.employeeName,
    department: json.department,
    organizationId: json.organizationId,
    leavePolicyId: parsePositiveInt(
      json.leavePolicyId ?? json.leavePolicy?.id,
      'parseLeaveRequest.leavePolicyId'
    ),
    leaveTypeName: json.leaveTypeName ?? json.leavePolicy?.leaveTypeName,
    startDate: json.startDate ? new Date(json.startDate) : new Date(),
    startHalfDayType: json.startHalfDayType as HalfDayType,
    endDate: json.endDate ? new Date(json.endDate) : new Date(),
    endHalfDayType: json.endHalfDayType as HalfDayType,
    totalDays: json.totalDays ?? 0,
    reason: json.reason ?? '',
    contactDuringLeave: json.contactDuringLeave,
    handoverToId: json.handoverToId,
    handoverToName: json.handoverToName ?? json.handoverTo?.name,
    handoverNotes: json.handoverNotes,
    status: (json.status as LeaveStatus) ?? LeaveStatus.DRAFT,
    currentApproverId: json.currentApproverId,
    currentApproverName: json.currentApproverName,
    currentApprovalLevel: json.currentApprovalLevel,
    maxApprovalLevel: json.maxApprovalLevel,
    cancellationReason: json.cancellationReason,
    approvals: json.approvals
      ? json.approvals.map((approval: any) => parseLeaveApproval(approval))
      : undefined,
    createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
    updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
    submittedAt: json.submittedAt ? new Date(json.submittedAt) : undefined,
    approvedAt: json.approvedAt ? new Date(json.approvedAt) : undefined,
    rejectedAt: json.rejectedAt ? new Date(json.rejectedAt) : undefined,
    cancelledAt: json.cancelledAt ? new Date(json.cancelledAt) : undefined,
    withdrawnAt: json.withdrawnAt ? new Date(json.withdrawnAt) : undefined,
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
