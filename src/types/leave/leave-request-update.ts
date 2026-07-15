/**
 * @module types/leave/leave-request-update
 *
 * The {@link UpdateLeaveRequestRequest} patch payload and its serializer
 * {@link updateLeaveRequestToJson}. Every field is optional; only set fields
 * are sent. Applies to draft requests before submission.
 */

import type { HalfDayType } from './leave-enums';

/** Patch fields for a draft leave request; an omitted field is left unchanged. */
export interface UpdateLeaveRequestRequest {
  /** New inclusive start date (ISO date string). */
  startDate?: string;
  /** New half-day type for the start day. */
  startHalfDayType?: HalfDayType | null;
  /** New inclusive end date (ISO date string). */
  endDate?: string;
  /** New half-day type for the end day. */
  endHalfDayType?: HalfDayType | null;
  /** New reason. */
  reason?: string;
  /** New during-leave contact. */
  contactDuringLeave?: string;
  /** New handover employee id. */
  handoverToId?: number;
  /** New handover instructions. */
  handoverNotes?: string;
}

/**
 * Serializes an {@link UpdateLeaveRequestRequest} into the backend patch body.
 *
 * Emits only the fields that are set (sparse patch).
 *
 * @param dto - The patch request to serialize.
 * @returns A plain object containing only the provided fields.
 */
export function updateLeaveRequestToJson(
  dto: UpdateLeaveRequestRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (dto.startDate !== undefined) json.startDate = dto.startDate;
  if (dto.startHalfDayType !== undefined)
    json.startHalfDayType = dto.startHalfDayType;
  if (dto.endDate !== undefined) json.endDate = dto.endDate;
  if (dto.endHalfDayType !== undefined)
    json.endHalfDayType = dto.endHalfDayType;
  if (dto.reason !== undefined) json.reason = dto.reason;
  if (dto.contactDuringLeave !== undefined)
    json.contactDuringLeave = dto.contactDuringLeave;
  if (dto.handoverToId !== undefined) json.handoverToId = dto.handoverToId;
  if (dto.handoverNotes !== undefined) json.handoverNotes = dto.handoverNotes;
  return json;
}
