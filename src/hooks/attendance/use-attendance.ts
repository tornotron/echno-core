/**
 * @module hooks/attendance/use-attendance
 *
 * React Query query hooks for core attendance data:
 * {@link useAttendanceById}, {@link useAttendanceByEmployee},
 * {@link useAttendanceByProject}, and {@link useAttendanceSummary}. Keyed via
 * {@link attendanceKeys}. All hooks inherit the default query-client
 * configuration (no per-hook option profile).
 *
 * Adjacent concerns live in dedicated hook folders:
 *   - hooks/attendance-settings/      attendance profiles + effective settings
 *   - hooks/attendance-regularization/ regularization queue + writes
 *   - hooks/shift-timing/             shift timings
 *   - hooks/movement/                 movement records
 */

import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '../../services/attendance-service';
import type { AttendanceListParams } from '../../types/attendance';
import { attendanceKeys } from './keys';

/**
 * Fetches a single attendance record by id.
 *
 * Keyed by `attendanceKeys.byId(id)`. Disabled until `id` is defined and
 * greater than `0`.
 *
 * @param id - Surrogate id of the attendance record. Pass `undefined` to defer
 *   the query until the id is available.
 * @returns A TanStack `UseQueryResult` wrapping an {@link Attendance} record.
 */
export function useAttendanceById(id: number | undefined) {
  return useQuery({
    queryKey: attendanceKeys.byId(id ?? 0),
    queryFn: () => attendanceService.getById(id!),
    enabled: id !== undefined && id > 0,
  });
}

/**
 * Fetches an employee's attendance records within a date range.
 *
 * Keyed by `attendanceKeys.byEmployee(employeeId, startDate, endDate)`.
 * Disabled until `employeeId`, `startDate`, and `endDate` are all truthy.
 *
 * @param employeeId - Surrogate id of the employee. Pass `undefined` to defer
 *   the query.
 * @param startDate - Inclusive range start (ISO date string).
 * @param endDate - Inclusive range end (ISO date string).
 * @returns A TanStack `UseQueryResult` wrapping an {@link Attendance} array.
 */
export function useAttendanceByEmployee(
  employeeId: number | undefined,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: attendanceKeys.byEmployee(employeeId ?? 0, startDate, endDate),
    queryFn: () =>
      attendanceService.getByEmployee(employeeId!, startDate, endDate),
    enabled: !!employeeId && !!startDate && !!endDate,
  });
}

/**
 * Fetches a paged set of attendance records for a project.
 *
 * Keyed by `attendanceKeys.byProject(params)`. Disabled until `params` is
 * non-null with a positive `projectId` and a non-empty `date`.
 *
 * @param params - Project id plus filter and paging options
 *   ({@link AttendanceListParams}). Pass `null` to defer the query.
 * @returns A TanStack `UseQueryResult` wrapping a {@link PagedAttendance} page.
 */
export function useAttendanceByProject(params: AttendanceListParams | null) {
  return useQuery({
    queryKey: attendanceKeys.byProject(params ?? { projectId: 0, date: '' }),
    queryFn: () => attendanceService.getByProject(params!),
    enabled: !!params && params.projectId > 0 && !!params.date,
  });
}

/**
 * Fetches an employee's monthly attendance summary.
 *
 * Keyed by `attendanceKeys.summary(employeeId, month, year)`. Disabled until
 * `employeeId` is truthy.
 *
 * @param employeeId - Surrogate id of the employee. Pass `undefined` to defer
 *   the query.
 * @param month - Month number (1–12).
 * @param year - Four-digit year.
 * @returns A TanStack `UseQueryResult` wrapping an {@link AttendanceSummary}.
 */
export function useAttendanceSummary(
  employeeId: number | undefined,
  month: number,
  year: number
) {
  return useQuery({
    queryKey: attendanceKeys.summary(employeeId ?? 0, month, year),
    queryFn: () => attendanceService.getSummary(employeeId!, month, year),
    enabled: !!employeeId,
  });
}

export { attendanceKeys } from './keys';
