/**
 * @module attendance-service
 *
 * Typed client for the core attendance endpoints under `/attendance/web` —
 * check-in, clock events, summaries, approvals, mark-absent, delete. All
 * methods throw {@link ApiError} on non-2xx responses and on parse failures
 * (mapped to a 422).
 *
 * Enum & field mapping (raw API ↔ SDK surface): the backend speaks
 * SCREAMING_SNAKE_CASE enums and a flatter field shape; this service
 * normalizes both on the way in, so consumers only ever see the camelCase
 * domain model. Specifically:
 * - Status, clock-event, and movement enums are mapped from
 *   SCREAMING_SNAKE_CASE to the SDK's camelCase enums (e.g. `PRESENT` →
 *   `present`, `MORNING_CLOCK_IN` → `morningClockIn`, `SITE_TRAVEL` →
 *   `siteTravel`).
 * - Field renames: `attendanceDate` → `date`, `eventTimestamp` →
 *   `timestamp`, flat `latitude`/`longitude`/`gpsAccuracy` → a nested
 *   `location` object, `distanceKm` → `distance`.
 * - `LocalTime` strings (`"09:00:00"`) are trimmed to `"HH:mm"`.
 * - The selfie is read from the clock event's image attachment, falling back
 *   to the legacy `photoUrl` string.
 * - A `Page<T>` response is normalized to {@link PagedAttendance}; a plain
 *   array is wrapped as a single page.
 *
 * Adjacent concerns live in dedicated service modules: attendance profiles +
 * effective settings (`attendance-settings-service.ts`), shift timings
 * (`shift-timing-service.ts`), regularizations
 * (`attendance-regularization-service.ts`), and movement records
 * (`movement-service.ts`). Attendance responses embed `shiftTiming`,
 * `movements[]`, and `regularization`, so parsers for those sub-entities are
 * kept inline here purely so this service can parse what the backend returns.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { parseLocalDateTime } from '../lib/utils/date-helpers';
import {
  attendanceCheckInToJson,
  attendanceListParamsToQuery,
  createClockEventToJson,
  type Attendance,
  type AttendanceSummary,
  type AttendanceCheckInRequest,
  type AttendanceListParams,
  type CreateClockEventRequest,
  type PagedAttendance,
} from '../types/attendance';
import { AttendanceStatus } from '../types/attendance/attendance-status';
import {
  ClockEventType,
  type ClockEvent,
} from '../types/attendance/clock-event';
import { MovementType } from '../types/attendance/movement-type';
import type { MovementRecord } from '../types/attendance/movement';
import type { ShiftTiming } from '../types/shift-timing';

// ─── Enum maps (response parsing only) ────────────────────────────────────────

const STATUS_FROM_BACKEND: Record<string, AttendanceStatus> = {
  PRESENT: AttendanceStatus.present,
  HALF_DAY: AttendanceStatus.halfDay,
  ABSENT: AttendanceStatus.absent,
  LEAVE: AttendanceStatus.leave,
  WEEKLY_OFF: AttendanceStatus.weeklyOff,
  HOLIDAY: AttendanceStatus.holiday,
  LATE: AttendanceStatus.late,
  EARLY_CHECKOUT: AttendanceStatus.earlyCheckout,
  OVERTIME: AttendanceStatus.overtime,
  PENDING_REGULARIZATION: AttendanceStatus.pendingRegularization,
};

const CLOCK_FROM_BACKEND: Record<string, ClockEventType> = {
  MORNING_CLOCK_IN: ClockEventType.morningClockIn,
  LUNCH_BREAK_START: ClockEventType.lunchBreakStart,
  LUNCH_BREAK_END: ClockEventType.lunchBreakEnd,
  EVENING_CLOCK_OUT: ClockEventType.eveningClockOut,
};

// Only needed to parse the `movements[]` embedded inside an attendance
// response. Writes go through `movement-service.ts`.
const MOVEMENT_FROM_BACKEND: Record<string, MovementType> = {
  SITE_TRAVEL: MovementType.siteTravel,
  CLIENT_MEETING: MovementType.clientMeeting,
  VENDOR_MEETING: MovementType.vendorMeeting,
  WORK_FROM_HOME: MovementType.workFromHome,
  ON_FIELD_WORK: MovementType.onFieldWork,
  TRAINING: MovementType.training,
  OFFICE_WORK: MovementType.officeWork,
  INSPECTION: MovementType.inspection,
  MATERIAL_PROCUREMENT: MovementType.materialProcurement,
  SUPERVISORY_VISIT: MovementType.supervisoryVisit,
  OTHER: MovementType.other,
};

// ─── Parsers ──────────────────────────────────────────────────────────────────

/** Backend returns "09:00:00" (LocalTime); frontend expects "09:00". */
function trimTime(t: string): string {
  return t?.slice(0, 5) ?? '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickClockEventPhotoUrl(raw: any): string {
  // Backend stores the selfie as an Attachment row on the ClockEvent. The
  // legacy `photoUrl` string field is only populated when the caller passed a
  // pre-existing URL instead of a multipart upload, so prefer the attachment
  // URL when both are present.

  const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageAttachment = attachments.find((a: any) =>
    typeof a?.contentType === 'string'
      ? a.contentType.startsWith('image/')
      : true
  );
  return imageAttachment?.url ?? raw.photoUrl ?? '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseClockEvent(raw: any): ClockEvent {
  return {
    id: raw.id ?? 0,
    eventType:
      CLOCK_FROM_BACKEND[raw.eventType] ?? ClockEventType.morningClockIn,
    // A punch time is a local wall clock, not an instant: parse it as local so it
    // reads back as the time the employee saw when they punched.
    timestamp:
      parseLocalDateTime(raw.eventTimestamp) ?? new Date(raw.eventTimestamp),
    location: {
      latitude: raw.latitude ?? 0,
      longitude: raw.longitude ?? 0,
      accuracy: raw.gpsAccuracy,
      altitude: raw.altitude,
    },
    photoUrl: pickClockEventPhotoUrl(raw),
    projectId: raw.projectId ?? 0,
    projectName: raw.projectName ?? '',
    deviceInfo: raw.devicePlatform
      ? {
          platform: raw.devicePlatform,
          deviceId: raw.deviceId ?? '',
          ipAddress: raw.ipAddress,
        }
      : undefined,
    isWithinGeofence: raw.isWithinGeofence ?? false,
    distanceFromProject: raw.distanceFromProject ?? 0,
    remarks: raw.remarks ?? undefined,
    verifiedBy: raw.verifiedBy ?? undefined,
    verifiedAt: raw.verifiedAt ? new Date(raw.verifiedAt) : undefined,
    isRegularized: raw.isRegularized ?? false,
    regularizationReason: raw.regularizationReason ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseShift(raw: any): ShiftTiming {
  return {
    id: raw.id,
    shiftName: raw.shiftName ?? '',
    startTime: trimTime(raw.startTime),
    endTime: trimTime(raw.endTime),
    lunchBreakStart: trimTime(raw.lunchBreakStart),
    lunchBreakEnd: trimTime(raw.lunchBreakEnd),
    gracePeriodMinutes: raw.gracePeriodMinutes ?? 15,
    minimumWorkHours: Number(raw.minimumWorkHours ?? 8),
    halfDayWorkHours: Number(raw.halfDayWorkHours ?? 4),
    overtimeThreshold: Number(raw.overtimeThreshold ?? 9),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMovement(raw: any): MovementRecord {
  return {
    id: raw.id ?? 0,
    attendanceId: raw.attendanceId ?? 0,
    employeeId: raw.employeeId ?? 0,
    employeeName: raw.employeeName ?? '',
    movementType: MOVEMENT_FROM_BACKEND[raw.movementType] ?? MovementType.other,
    fromLocation: raw.fromLocation ?? '',
    toLocation: raw.toLocation ?? undefined,
    startTime: new Date(raw.startTime),
    endTime: raw.endTime ? new Date(raw.endTime) : undefined,
    durationMinutes: raw.durationMinutes ?? undefined,
    distance: raw.distanceKm ?? undefined,
    purpose: raw.purpose ?? '',
    remarks: raw.remarks ?? undefined,
    startLatitude: raw.startLatitude ?? undefined,
    startLongitude: raw.startLongitude ?? undefined,
    endLatitude: raw.endLatitude ?? undefined,
    endLongitude: raw.endLongitude ?? undefined,
    verifiedBy: raw.verifiedBy ?? undefined,
    verifiedAt: raw.verifiedAt ? new Date(raw.verifiedAt) : undefined,
    isVerified: raw.isVerified ?? false,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : undefined,
    createdAt: new Date(raw.createdAt ?? Date.now()),
    updatedAt: new Date(raw.updatedAt ?? Date.now()),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAttendance(raw: any): Attendance {
  const clockEvents: ClockEvent[] = Array.isArray(raw.clockEvents)
    ? raw.clockEvents.map((element: unknown) => parseClockEvent(element))
    : [];

  const findEvent = (type: ClockEventType) =>
    clockEvents.find((e) => e.eventType === type);

  const reg = Array.isArray(raw.regularizations)
    ? raw.regularizations[0]
    : undefined;

  return {
    id: raw.id ?? 0,
    employeeId: raw.employeeId ?? 0,
    employeeName: raw.employeeName ?? '',
    date: new Date(raw.attendanceDate ?? raw.date),
    projectId: raw.projectId ?? 0,
    projectName: raw.projectName ?? '',
    status:
      STATUS_FROM_BACKEND[raw.status] ?? AttendanceStatus.pendingRegularization,
    shiftTiming: raw.shiftTiming
      ? parseShift(raw.shiftTiming)
      : {
          id: 0,
          shiftName: '',
          startTime: '',
          endTime: '',
          lunchBreakStart: '',
          lunchBreakEnd: '',
          gracePeriodMinutes: 15,
          minimumWorkHours: 8,
          halfDayWorkHours: 4,
          overtimeThreshold: 9,
        },
    morningClockIn: findEvent(ClockEventType.morningClockIn),
    lunchBreakStart: findEvent(ClockEventType.lunchBreakStart),
    lunchBreakEnd: findEvent(ClockEventType.lunchBreakEnd),
    eveningClockOut: findEvent(ClockEventType.eveningClockOut),
    workDuration: {
      totalMinutes: raw.totalWorkMinutes ?? 0,
      hours: Math.floor((raw.totalWorkMinutes ?? 0) / 60),
      minutes: (raw.totalWorkMinutes ?? 0) % 60,
      morningSession: raw.morningSessionMinutes ?? 0,
      afternoonSession: raw.afternoonSessionMinutes ?? 0,
      overtimeMinutes: raw.overtimeMinutes ?? 0,
      breakDuration: raw.breakDurationMinutes ?? 0,
    },
    isLateArrival: raw.isLateArrival ?? false,
    isEarlyCheckout: raw.isEarlyCheckout ?? false,
    isOvertime: raw.isOvertime ?? false,
    leaveId: raw.leaveId ?? undefined,
    leaveType: raw.leaveType ?? undefined,
    regularization: reg
      ? {
          id: reg.id ?? 0,
          attendanceId: reg.attendanceId ?? raw.id ?? 0,
          reason: reg.reason ?? '',
          requestedBy: reg.requestedBy ?? '',
          requestedAt: new Date(reg.requestedAt),
          approvedBy: reg.approvedBy ?? undefined,
          approvedAt: reg.approvedAt ? new Date(reg.approvedAt) : undefined,
          status: (reg.status?.toLowerCase() ?? 'pending') as
            | 'pending'
            | 'approved'
            | 'rejected',
          rejectionReason: reg.rejectionReason ?? undefined,
          missingEvents: Array.isArray(reg.missingEvents)
            ? reg.missingEvents
            : [],
        }
      : undefined,
    movements: Array.isArray(raw.movements)
      ? raw.movements.map((element: unknown) => parseMovement(element))
      : undefined,
    approvalStatus: (raw.approvalStatus?.toLowerCase() ?? 'pending') as
      | 'pending'
      | 'approved'
      | 'rejected',
    approvedBy: raw.approvedBy ?? undefined,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : undefined,
    remarks: raw.remarks ?? undefined,
    createdAt: new Date(raw.createdAt ?? Date.now()),
    updatedAt: new Date(raw.updatedAt ?? Date.now()),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSummary(raw: any): AttendanceSummary {
  return {
    employeeId: raw.employeeId ?? 0,
    employeeName: raw.employeeName ?? '',
    month: raw.month ?? 1,
    year: raw.year ?? new Date().getFullYear(),
    totalWorkingDays: raw.totalWorkingDays ?? 0,
    presentDays: raw.presentDays ?? 0,
    halfDays: raw.halfDays ?? 0,
    absentDays: raw.absentDays ?? 0,
    leaveDays: raw.leaveDays ?? 0,
    weeklyOffs: raw.weeklyOffs ?? 0,
    holidays: raw.holidays ?? 0,
    lateDays: raw.lateDays ?? 0,
    overtimeDays: raw.overtimeDays ?? 0,
    totalHoursWorked: raw.totalHoursWorked ?? 0,
    totalOvertimeHours: raw.totalOvertimeHours ?? 0,
    averageWorkHours: raw.averageWorkHours ?? 0,
    attendancePercentage: raw.attendancePercentage ?? 0,
    effectiveWorkDays: raw.effectiveWorkDays ?? 0,
    baseSalary: raw.baseSalary ?? undefined,
    attendanceDeductions: raw.attendanceDeductions ?? undefined,
    overtimePay: raw.overtimePay ?? undefined,
    netSalary: raw.netSalary ?? undefined,
    projectWiseAttendance: Array.isArray(raw.projectWiseAttendance)
      ? raw.projectWiseAttendance
      : undefined,
  };
}

// ─── Safe wrappers ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeOne<T>(parser: (raw: any) => T, label: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (raw: any): T => {
    try {
      return parser(raw);
    } catch (error) {
      logger.error(`Failed to parse ${label}:`, error);
      throw new ApiError(`Failed to process ${label} data.`, 422);
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeMany<T>(parser: (raw: any) => T, label: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data: any[]): T[] => {
    if (!Array.isArray(data)) return [];
    try {
      return data.map((element) => parser(element));
    } catch (error) {
      logger.error(`Failed to parse ${label} list:`, error);
      throw new ApiError(`Failed to process ${label} data.`, 422);
    }
  };
}

const safeAttendance = safeOne(parseAttendance, 'attendance record');
const safeAttendances = safeMany(parseAttendance, 'attendance record');

// ─── Service ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export const attendanceService = {
  // ── Core Attendance ────────────────────────────────────────────────────────

  /**
   * Records an employee's first check-in for the day.
   *
   * `POST /attendance/web/check-in` (multipart) → `AttendanceResponseDto`
   * (full). The DTO is JSON-encoded in the `data` query param; the selfie is
   * sent multipart under the `photo` field.
   *
   * @param req - Check-in details, including the optional selfie `photo`.
   * @returns The created/updated {@link Attendance} record.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async checkIn(req: AttendanceCheckInRequest): Promise<Attendance> {
    // Backend contract: DTO is JSON-encoded in the `data` query param, the
    // selfie is multipart under the `photo` field (see attendance-controller-web).
    const endpoint = `/attendance/web/check-in?data=${encodeURIComponent(
      JSON.stringify(attendanceCheckInToJson(req))
    )}`;
    const formData = new FormData();
    if (req.photo) formData.append('photo', req.photo);
    const data = await api.postFormData<Raw>(endpoint, formData);
    return safeAttendance(data);
  },

  /**
   * Records a subsequent clock event (lunch break or clock-out) for the day.
   *
   * `POST /attendance/web/clock-event` (multipart) → `AttendanceResponseDto`
   * (full). The DTO is JSON-encoded in the `data` query param; the selfie is
   * sent multipart under the `photo` field.
   *
   * @param req - Clock-event details, including the optional selfie `photo`.
   * @returns The updated {@link Attendance} record.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async recordClockEvent(req: CreateClockEventRequest): Promise<Attendance> {
    // Backend contract: DTO is JSON-encoded in the `data` query param, the
    // selfie is multipart under the `photo` field (see attendance-controller-web).
    const endpoint = `/attendance/web/clock-event?data=${encodeURIComponent(
      JSON.stringify(createClockEventToJson(req))
    )}`;
    const formData = new FormData();
    if (req.photo) formData.append('photo', req.photo);
    const data = await api.postFormData<Raw>(endpoint, formData);
    return safeAttendance(data);
  },

  /**
   * Fetches a single attendance record by id.
   *
   * `GET /attendance/web/{id}`
   *
   * @param id - Surrogate id of the attendance record.
   * @returns The {@link Attendance} record.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: number): Promise<Attendance> {
    const data = await api.get<Raw>(`/attendance/web/${id}`);
    return safeAttendance(data);
  },

  /**
   * Fetches an employee's attendance records within a date range.
   *
   * `GET /attendance/web/employee/{employeeId}?startDate&endDate`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param startDate - Inclusive range start (ISO date string).
   * @param endDate - Inclusive range end (ISO date string).
   * @returns The matching {@link Attendance} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getByEmployee(
    employeeId: number,
    startDate: string,
    endDate: string
  ): Promise<Attendance[]> {
    const data = await api.get<Raw[]>(
      `/attendance/web/employee/${employeeId}`,
      { startDate, endDate }
    );
    return safeAttendances(data);
  },

  /**
   * Fetches a paged set of attendance records for a project.
   *
   * `GET /attendance/web/project/{projectId}` with filter/paging params.
   * Normalizes both a Spring `Page<T>` body and a plain array into
   * {@link PagedAttendance} so the caller always receives page metadata.
   *
   * @param params - Project id plus filter and paging options
   *   ({@link AttendanceListParams}).
   * @returns A {@link PagedAttendance} page of records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getByProject(params: AttendanceListParams): Promise<PagedAttendance> {
    const data = await api.get<Raw>(
      `/attendance/web/project/${params.projectId}`,
      attendanceListParamsToQuery(params)
    );
    // Spring usually serializes Page<T> as `{ content, totalElements, … }`, but
    // some servers return a plain array. Handle both so the UI doesn't silently
    // show an empty page.
    if (Array.isArray(data)) {
      const content = safeAttendances(data);
      return {
        content,
        totalElements: content.length,
        totalPages: 1,
        number: 0,
        size: params.size ?? content.length,
      };
    }
    return {
      content: safeAttendances(data.content ?? []),
      totalElements: data.totalElements ?? 0,
      totalPages: data.totalPages ?? 0,
      number: data.number ?? 0,
      size: data.size ?? params.size ?? 20,
    };
  },

  /**
   * Approves or rejects an attendance record.
   *
   * `POST /attendance/web/{id}/approve` → `AttendanceResponseDto` (full).
   *
   * @param id - Surrogate id of the attendance record.
   * @param approvalStatus - The decision: `'APPROVED'` or `'REJECTED'`.
   * @param remarks - Optional decision remarks.
   * @returns The updated {@link Attendance} record.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async approve(
    id: number,
    approvalStatus: 'APPROVED' | 'REJECTED',
    remarks?: string
  ): Promise<Attendance> {
    const data = await api.post<Raw>(`/attendance/web/${id}/approve`, {
      approvalStatus,
      remarks,
    });
    return safeAttendance(data);
  },

  /**
   * Marks an employee absent for a given day on a project.
   *
   * `POST /attendance/web/mark-absent` → `AttendanceResponseDto` (full).
   *
   * @param employeeId - Surrogate id of the employee.
   * @param projectId - Surrogate id of the project.
   * @param date - The day to mark absent (ISO date string).
   * @returns The created/updated {@link Attendance} record.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async markAbsent(
    employeeId: number,
    projectId: number,
    date: string
  ): Promise<Attendance> {
    const data = await api.post<Raw>('/attendance/web/mark-absent', null, {
      employeeId,
      projectId,
      date,
    });
    return safeAttendance(data);
  },

  /**
   * Fetches an employee's monthly attendance summary.
   *
   * `GET /attendance/web/summary/{employeeId}?month&year`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param month - Month number (1–12).
   * @param year - Four-digit year.
   * @returns The {@link AttendanceSummary} for the period.
   * @throws {ApiError} On non-2xx responses or if the summary fails to parse.
   */
  async getSummary(
    employeeId: number,
    month: number,
    year: number
  ): Promise<AttendanceSummary> {
    const data = await api.get<Raw>(`/attendance/web/summary/${employeeId}`, {
      month,
      year,
    });
    try {
      return parseSummary(data);
    } catch (error) {
      logger.error('Failed to parse attendance summary:', error);
      throw new ApiError('Failed to process attendance summary.', 422);
    }
  },

  /**
   * Deletes an attendance record.
   *
   * `DELETE /attendance/web/{id}` → `ApiResponse` (ack).
   *
   * @param id - Surrogate id of the attendance record.
   * @returns Resolves once the record is deleted.
   * @throws {ApiError} On non-2xx responses.
   */
  async deleteAttendance(id: number): Promise<void> {
    await api.delete(`/attendance/web/${id}`);
  },
};
