/**
 * @module types/leave/leave-notification
 *
 * The {@link LeaveNotification} entity and its parser
 * {@link parseLeaveNotification}.
 */

import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { LeaveNotificationType } from './leave-enums';
import {
  backendDate,
  nullableBoolean,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

const LeaveNotificationResponseSchema = z.object({
  id: opaque,
  employeeId: opaque,
  type: nullableString,
  title: nullableString,
  message: nullableString,
  leaveRequestId: optionalNumericId,
  isRead: nullableBoolean,
  createdAt: backendDate,
  readAt: backendDate,
});

/** A notification raised by a leave-workflow event. */
export interface LeaveNotification {
  /** Unique surrogate identifier. */
  id: number;
  /** Employee the notification is addressed to. */
  employeeId: number;
  /** Category of the notification. */
  type: LeaveNotificationType;
  /** Short headline. */
  title: string;
  /** Notification body text. */
  message: string;
  /** Related leave request, when applicable. */
  leaveRequestId?: number;
  /** Whether the recipient has read it. */
  isRead: boolean;
  /** When the notification was created. */
  createdAt: Date;
  /** When the notification was read, if read. */
  readAt?: Date;
}

/**
 * Parses a raw notification payload into a typed {@link LeaveNotification}.
 *
 * Validates `id` and `employeeId` as positive ints, defaults `type` to
 * `LEAVE_REMINDER` and `isRead` to `false`, and hydrates `createdAt`
 * (defaulting to now) and `readAt` into `Date` objects.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `LeaveNotification` domain object.
 * @throws {Error} If `id` or `employeeId` is missing or not a positive int.
 */
export function parseLeaveNotification(json: unknown): LeaveNotification {
  const raw = LeaveNotificationResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseLeaveNotification.id'),
    employeeId: parsePositiveInt(
      raw.employeeId,
      'parseLeaveNotification.employeeId'
    ),
    type:
      (raw.type as LeaveNotificationType) ??
      LeaveNotificationType.LEAVE_REMINDER,
    title: raw.title ?? '',
    message: raw.message ?? '',
    leaveRequestId: raw.leaveRequestId ?? undefined,
    isRead: raw.isRead ?? false,
    createdAt: parseUTCDate(raw.createdAt) ?? new Date(),
    readAt: parseUTCDate(raw.readAt) ?? undefined,
  };
}
