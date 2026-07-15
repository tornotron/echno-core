/**
 * @module types/leave/leave-request-create
 *
 * The {@link CreateLeaveRequestRequest} payload and its serializer
 * {@link createLeaveRequestToJson} for creating a leave request. See
 * `leave-request-update.ts` for the patch counterpart.
 */

import type { HalfDayType } from './leave-enums';

/** Fields required to create a leave request. */
export interface CreateLeaveRequestRequest {
  /** Employee filing the request. */
  employeeId: number;
  /** Policy the request is filed under. */
  leavePolicyId: number;
  /** Inclusive start date (ISO date string). */
  startDate: string;
  /** Half-day type for the start day. */
  startHalfDayType?: HalfDayType | null;
  /** Inclusive end date (ISO date string). */
  endDate: string;
  /** Half-day type for the end day. */
  endHalfDayType?: HalfDayType | null;
  /** Reason for the request. */
  reason: string;
  /** How to reach the employee during leave. */
  contactDuringLeave?: string;
  /** Employee taking over the requester's duties. */
  handoverToId?: number;
  /** Handover instructions. */
  handoverNotes?: string;
  /** When `true`, submit for approval immediately instead of saving a draft. */
  submitImmediately?: boolean;
}

/**
 * Serializes a {@link CreateLeaveRequestRequest} into the backend request body.
 *
 * All fields are passed through; `submitImmediately` defaults to `false`.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend's expected body shape.
 */
export function createLeaveRequestToJson(
  dto: CreateLeaveRequestRequest
): Record<string, unknown> {
  return {
    employeeId: dto.employeeId,
    leavePolicyId: dto.leavePolicyId,
    startDate: dto.startDate,
    startHalfDayType: dto.startHalfDayType,
    endDate: dto.endDate,
    endHalfDayType: dto.endHalfDayType,
    reason: dto.reason,
    contactDuringLeave: dto.contactDuringLeave,
    handoverToId: dto.handoverToId,
    handoverNotes: dto.handoverNotes,
    submitImmediately: dto.submitImmediately ?? false,
  };
}
