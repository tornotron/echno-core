/**
 * @module types/leave/leave-notification
 *
 * The {@link LeaveNotification} entity and its parser
 * {@link parseLeaveNotification}.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { parsePositiveInt } from '../../lib/utils/parse-id';
import { LeaveNotificationType } from './leave-enums';

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
export function parseLeaveNotification(json: any): LeaveNotification {
  return {
    id: parsePositiveInt(json.id, 'parseLeaveNotification.id'),
    employeeId: parsePositiveInt(
      json.employeeId,
      'parseLeaveNotification.employeeId'
    ),
    type:
      (json.type as LeaveNotificationType) ??
      LeaveNotificationType.LEAVE_REMINDER,
    title: json.title ?? '',
    message: json.message ?? '',
    leaveRequestId: json.leaveRequestId,
    isRead: json.isRead ?? false,
    createdAt: json.createdAt ? new Date(json.createdAt) : new Date(),
    readAt: json.readAt ? new Date(json.readAt) : undefined,
  };
}
