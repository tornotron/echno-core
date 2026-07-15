/**
 * @module hooks/attendance/use-attendance-mutations
 *
 * React Query mutation hooks for core attendance writes: {@link useCheckIn},
 * {@link useRecordClockEvent}, {@link useApproveAttendance},
 * {@link useMarkAbsent}, and {@link useDeleteAttendance}.
 *
 * Adjacent mutation hooks live in:
 *   - hooks/attendance-settings/use-attendance-settings-mutations.ts
 *   - hooks/attendance-regularization/use-attendance-regularization-mutations.ts
 *   - hooks/shift-timing/use-shift-timing-mutations.ts
 *   - hooks/movement/use-movement-mutations.ts
 *
 * Cache discipline: endpoints that return the full `AttendanceResponseDto`
 * patch the `detail` cache and the paged list caches directly; the delete
 * endpoint returns only an acknowledgement, so it evicts the detail entry and
 * removes the record from list caches without a patch payload. Monthly summary
 * caches are invalidated (not patched) because the backend aggregates their
 * counters server-side.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Attendance,
  AttendanceCheckInRequest,
  CreateClockEventRequest,
} from '../../types/attendance';
import { attendanceKeys } from './keys';
import { attendanceService } from '../../services/attendance-service';

/**
 * Matches every paged Attendance list cache under the 'attendance' namespace
 * (project- or employee-scoped). Excludes detail / summary entries which live
 * under the same root key but carry different shapes.
 */
function isAttendanceListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'attendance' &&
    (key[1] === 'project' || key[1] === 'employee')
  );
}

/**
 * Patch a single Attendance record across all cached list shapes:
 *   - paginated project lists: `{ content: Attendance[], ... }`
 *   - per-employee arrays: `Attendance[]`
 * Updaters return `undefined` for absent caches so we don't seed stale entries.
 */
function patchAttendanceInLists(
  queryClient: ReturnType<typeof useQueryClient>,
  attendance: Attendance
) {
  queryClient.setQueriesData(
    { predicate: isAttendanceListCache },
    (old: unknown) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return (old as Attendance[]).map((a) =>
          a.id === attendance.id ? attendance : a
        );
      }
      if (typeof old === 'object' && 'content' in (old as object)) {
        const paged = old as { content: Attendance[]; [k: string]: unknown };
        return {
          ...paged,
          content: paged.content.map((a) =>
            a.id === attendance.id ? attendance : a
          ),
        };
      }
      return old;
    }
  );
}

/**
 * Remove a single Attendance record across all cached list shapes after a
 * delete. Mirrors `patchAttendanceInLists` over the same shapes.
 */
function removeAttendanceFromLists(
  queryClient: ReturnType<typeof useQueryClient>,
  id: number
) {
  queryClient.setQueriesData(
    { predicate: isAttendanceListCache },
    (old: unknown) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return (old as Attendance[]).filter((a) => a.id !== id);
      }
      if (typeof old === 'object' && 'content' in (old as object)) {
        const paged = old as { content: Attendance[]; [k: string]: unknown };
        return { ...paged, content: paged.content.filter((a) => a.id !== id) };
      }
      return old;
    }
  );
}

// ─── Core Attendance ──────────────────────────────────────────────────────────

/**
 * Records an employee's first check-in for the day.
 *
 * Backend response: `AttendanceResponseDto` (full).
 *
 * On success:
 * - `setQueryData(attendanceKeys.byId(id), attendance)` — seeds the detail
 *   cache with the created record.
 * - `invalidateQueries({ predicate: isAttendanceListCache })` — kept: check-in
 *   creates a brand-new row, and {@link patchAttendanceInLists} only `.map()`s
 *   over existing entries, so the new record would not surface. Invalidation
 *   forces the list caches to refetch and include it.
 * - `invalidateQueries([...attendanceKeys.all, 'summary', employeeId])` — kept
 *   (cross-key): the monthly summary aggregates day counts server-side.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts an
 *   {@link AttendanceCheckInRequest}.
 */
export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: AttendanceCheckInRequest) =>
      attendanceService.checkIn(req),
    onSuccess: (attendance) => {
      // POST /attendance/web/check-in → AttendanceResponseDto (full).
      queryClient.setQueryData<Attendance>(
        attendanceKeys.byId(attendance.id),
        attendance
      );
      // Check-in CREATES a new attendance row; patchAttendanceInLists only
      // updates existing entries via .map, so a brand-new record wouldn't
      // surface in cached lists. Invalidate the list caches instead so they
      // refetch and include the new row.
      queryClient.invalidateQueries({ predicate: isAttendanceListCache });
      // Cross-key: monthly summary aggregates counts; invalidate the matching
      // summary cache so percentages reflect the new check-in.
      queryClient.invalidateQueries({
        queryKey: [...attendanceKeys.all, 'summary', attendance.employeeId],
      });
    },
  });
}

/**
 * Records a subsequent clock event (lunch break or clock-out) for the day.
 *
 * Backend response: `AttendanceResponseDto` (full).
 *
 * On success:
 * - `setQueryData(attendanceKeys.byId(id), attendance)` — replaces the detail
 *   cache with the updated record.
 * - {@link patchAttendanceInLists} — replaces the record in place across every
 *   cached list shape (paged project lists and per-employee arrays).
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts a
 *   {@link CreateClockEventRequest}.
 */
export function useRecordClockEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateClockEventRequest) =>
      attendanceService.recordClockEvent(req),
    onSuccess: (attendance) => {
      // POST /attendance/web/clock-event → AttendanceResponseDto (full).
      queryClient.setQueryData<Attendance>(
        attendanceKeys.byId(attendance.id),
        attendance
      );
      patchAttendanceInLists(queryClient, attendance);
    },
  });
}

/**
 * Approves or rejects an attendance record.
 *
 * Backend response: `AttendanceResponseDto` (full).
 *
 * On success:
 * - `setQueryData(attendanceKeys.byId(id), attendance)` — replaces the detail
 *   cache with the record carrying the new approval state.
 * - {@link patchAttendanceInLists} — replaces the record in place across every
 *   cached list shape.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; approvalStatus: 'APPROVED' | 'REJECTED'; remarks?: string }`.
 */
export function useApproveAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      approvalStatus,
      remarks,
    }: {
      id: number;
      approvalStatus: 'APPROVED' | 'REJECTED';
      remarks?: string;
    }) => attendanceService.approve(id, approvalStatus, remarks),
    onSuccess: (attendance) => {
      // POST /attendance/web/{id}/approve → AttendanceResponseDto (full).
      queryClient.setQueryData<Attendance>(
        attendanceKeys.byId(attendance.id),
        attendance
      );
      patchAttendanceInLists(queryClient, attendance);
    },
  });
}

/**
 * Marks an employee absent for a given day on a project.
 *
 * Backend response: `AttendanceResponseDto` (full).
 *
 * On success:
 * - `setQueryData(attendanceKeys.byId(id), attendance)` — seeds the detail
 *   cache with the created/updated record.
 * - {@link patchAttendanceInLists} — replaces the record in place across every
 *   cached list shape.
 * - `invalidateQueries([...attendanceKeys.all, 'summary', employeeId])` — kept
 *   (cross-key): marking absent shifts the monthly summary's `absentDays`
 *   counter, which the backend recomputes.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ employeeId: number; projectId: number; date: string }`.
 */
export function useMarkAbsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      projectId,
      date,
    }: {
      employeeId: number;
      projectId: number;
      date: string;
    }) => attendanceService.markAbsent(employeeId, projectId, date),
    onSuccess: (attendance) => {
      // POST /attendance/web/mark-absent → AttendanceResponseDto (full).
      queryClient.setQueryData<Attendance>(
        attendanceKeys.byId(attendance.id),
        attendance
      );
      patchAttendanceInLists(queryClient, attendance);
      // Cross-key: monthly summary absentDays count changes.
      queryClient.invalidateQueries({
        queryKey: [...attendanceKeys.all, 'summary', attendance.employeeId],
      });
    },
  });
}

/**
 * Deletes an attendance record.
 *
 * Backend response: `ApiResponse` (ack).
 *
 * On success:
 * - `removeQueries(attendanceKeys.byId(id))` — evicts the detail entry; the
 *   record no longer exists, so there is nothing to refetch.
 * - {@link removeAttendanceFromLists} — filters the record out of every cached
 *   list shape.
 * - `invalidateQueries([...attendanceKeys.all, 'summary', employeeId])` — kept
 *   (cross-key): removing a day changes the monthly summary counters. The
 *   affected employee is read from the pre-delete cached record when present;
 *   otherwise the whole `summary` namespace is invalidated as a fallback.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts the
 *   attendance record `id` (`number`).
 */
export function useDeleteAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => attendanceService.deleteAttendance(id),
    onSuccess: (_void, id) => {
      // DELETE /attendance/web/{id} → ApiResponse (ack).
      const removed = queryClient.getQueryData<Attendance>(
        attendanceKeys.byId(id)
      );
      queryClient.removeQueries({ queryKey: attendanceKeys.byId(id) });
      removeAttendanceFromLists(queryClient, id);
      if (removed) {
        queryClient.invalidateQueries({
          queryKey: [...attendanceKeys.all, 'summary', removed.employeeId],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: [...attendanceKeys.all, 'summary'],
        });
      }
    },
  });
}
