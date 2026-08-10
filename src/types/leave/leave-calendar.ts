/**
 * @module types/leave/leave-calendar
 *
 * The leave-calendar entities — a per-day {@link LeaveCalendarEntry}, its
 * date-grouped {@link GroupedLeaveCalendarEntry}, and the on-leave
 * {@link LeaveCountResponse} — plus the parsers
 * {@link parseLeaveCalendarEntry} and {@link parseGroupedLeaveCalendarEntry}.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { parsePositiveInt } from '../../lib/utils/parse-id';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { HalfDayType, LeaveStatus } from './leave-enums';

/** One employee's leave on one calendar day. */
export interface LeaveCalendarEntry {
  /** Unique surrogate identifier. */
  id: number;
  /** Leave request the entry derives from. */
  leaveRequestId: number;
  /** Employee on leave. */
  employeeId: number;
  /** Denormalized employee display name. */
  employeeName?: string;
  /** Denormalized department name. */
  department?: string;
  /** The leave day (parsed to a `Date` by the parser). */
  leaveDate: Date | string;
  /** Whether the day is full or a specific half. */
  halfDayType: HalfDayType;
  /** Denormalized leave-type display name. */
  leaveTypeName?: string;
  /** Status of the underlying request. */
  status?: LeaveStatus;
  /** Record creation timestamp. */
  createdAt?: Date;
}

/** All leave entries for a single date, grouped. */
export interface GroupedLeaveCalendarEntry {
  /** The calendar day. */
  date: Date;
  /** Entries falling on {@link date}. */
  entries: LeaveCalendarEntry[];
  /** Number of entries on the day. */
  count: number;
}

/** Count of employees on leave on a given date. */
export interface LeaveCountResponse {
  /** The day counted. */
  date: Date;
  /** Number of employees on leave that day. */
  count: number;
}

/**
 * Parses a raw calendar-entry payload into a typed {@link LeaveCalendarEntry}.
 *
 * Validates `id`, `leaveRequestId`, and `employeeId` as positive ints, hydrates
 * `leaveDate` (defaulting to now) and `createdAt` into `Date` objects, and
 * defaults `halfDayType` to `FULL_DAY`.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `LeaveCalendarEntry` domain object.
 * @throws {Error} If `id`, `leaveRequestId`, or `employeeId` is missing or not a
 *   positive int.
 */
export function parseLeaveCalendarEntry(json: any): LeaveCalendarEntry {
  return {
    id: parsePositiveInt(json.id, 'parseLeaveCalendarEntry.id'),
    leaveRequestId: parsePositiveInt(
      json.leaveRequestId,
      'parseLeaveCalendarEntry.leaveRequestId'
    ),
    employeeId: parsePositiveInt(
      json.employeeId,
      'parseLeaveCalendarEntry.employeeId'
    ),
    employeeName: json.employeeName,
    department: json.department,
    leaveDate: parseUTCDate(json.leaveDate) ?? new Date(),
    halfDayType: (json.halfDayType as HalfDayType) ?? HalfDayType.FULL_DAY,
    leaveTypeName: json.leaveTypeName,
    status: json.status as LeaveStatus,
    createdAt: parseUTCDate(json.createdAt) ?? undefined,
  };
}

/**
 * Parses a raw grouped-entry payload into a typed
 * {@link GroupedLeaveCalendarEntry}.
 *
 * Hydrates `date` (defaulting to now) into a `Date`, recursively parses each
 * embedded entry, and defaults `count` to `0`.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `GroupedLeaveCalendarEntry` domain object.
 */
export function parseGroupedLeaveCalendarEntry(
  json: any

): GroupedLeaveCalendarEntry {
  return {
    date: parseUTCDate(json.date) ?? new Date(),
    entries: json.entries
      ? json.entries.map((e: any) => parseLeaveCalendarEntry(e))
      : [],
    count: json.count ?? 0,
  };
}