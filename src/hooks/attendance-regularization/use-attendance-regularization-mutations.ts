/**
 * @module hooks/attendance-regularization/use-attendance-regularization-mutations
 *
 * React Query mutation hooks for attendance-regularization writes:
 * {@link useRequestRegularization} and {@link useProcessRegularization}.
 *
 * Cache discipline: the backend returns the base `AttendanceRegularizationDto`,
 * whose enriched context fields (`employeeId`, `employeeName`,
 * `attendanceDate`, `projectId`, `projectName` — see `ENRICHED_KEYS`) may be
 * absent on a freshly written entity. The detail cache is therefore merged via
 * {@link mergePreservingNested} to preserve any enriched values already
 * cached. The parent attendance detail embeds `.regularization` and is patched
 * directly when cached; project- and employee-scoped list caches are
 * invalidated so derived status badges refresh.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceRegularizationService } from '../../services/attendance-regularization-service';
import type {
  Attendance,
  CreateRegularizationRequest,
  RegularizationDetail,
} from '../../types/attendance';
import { mergePreservingNested } from '../../lib/query/cache-merge';
import { attendanceKeys } from '../attendance/keys';
import { attendanceRegularizationKeys } from './keys';

const ENRICHED_KEYS = [
  'employeeId',
  'employeeName',
  'attendanceDate',
  'projectId',
  'projectName',
] as const satisfies ReadonlyArray<keyof RegularizationDetail>;

/**
 * Matches every paged Attendance list cache under the 'attendance' namespace
 * (project- or employee-scoped). Used to invalidate derived status badges
 * when a regularization's status changes.
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
 * Raises a regularization request for an attendance day.
 *
 * Backend response: `AttendanceRegularizationDto` (partial — enriched
 * `employeeId`, `employeeName`, `attendanceDate`, `projectId`, `projectName`
 * may be absent on a freshly created entity).
 *
 * On success:
 * - `setQueryData(attendanceRegularizationKeys.detail(id), merge)` — uses
 *   {@link mergePreservingNested} with `ENRICHED_KEYS` to preserve any cached
 *   enriched context fields; seeds the entity when no prior cache exists.
 * - `setQueryData(attendanceKeys.byId(attendanceId), patch)` — patches the
 *   parent attendance's embedded `.regularization` when that record is cached.
 * - `invalidateQueries(attendanceRegularizationKeys.pending())` — kept: the
 *   pending queue grows by one.
 * - `invalidateQueries({ predicate: isAttendanceListCache })` — kept: list
 *   views surface a regularization badge derived server-side.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ req: CreateRegularizationRequest; requestedBy: string }`.
 */
export function useRequestRegularization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      req,
      requestedBy,
    }: {
      req: CreateRegularizationRequest;
      requestedBy: string;
    }) => attendanceRegularizationService.request(req, requestedBy),
    onSuccess: (reg) => {
      // POST /attendance-regularizations/web/request → AttendanceRegularizationDto
      // (base DTO; RegularizationDetail's enriched fields
      // employeeId/employeeName/attendanceDate/projectId/projectName may
      // be absent on a freshly created entity).
      queryClient.setQueryData<RegularizationDetail>(
        attendanceRegularizationKeys.detail(reg.id),
        (old) => (old ? mergePreservingNested(old, reg, ENRICHED_KEYS) : reg)
      );
      // Parent attendance detail embeds the regularization.
      queryClient.setQueryData<Attendance>(
        attendanceKeys.byId(reg.attendanceId),
        (old) => (old ? { ...old, regularization: reg } : old)
      );
      // Pending queue grows by one; list views show regularization badge.
      queryClient.invalidateQueries({
        queryKey: attendanceRegularizationKeys.pending(),
      });
      queryClient.invalidateQueries({ predicate: isAttendanceListCache });
    },
  });
}

/**
 * Approves or rejects a pending regularization request.
 *
 * Backend response: `AttendanceRegularizationDto` (partial — enriched context
 * fields may be absent).
 *
 * On success:
 * - `setQueryData(attendanceRegularizationKeys.detail(id), merge)` — uses
 *   {@link mergePreservingNested} with `ENRICHED_KEYS` to preserve cached
 *   enriched fields.
 * - `invalidateQueries(attendanceRegularizationKeys.pending())` — kept: the
 *   pending queue shrinks once a request is processed.
 * - `invalidateQueries(attendanceKeys.byId(attendanceId))` — kept
 *   (cross-namespace): processing flips the parent attendance status (e.g.
 *   `pendingRegularization` → `present`), recomputed server-side.
 * - `invalidateQueries({ predicate: isAttendanceListCache })` — kept: derived
 *   list badges change with the parent status.
 * - `invalidateQueries([...attendanceKeys.all, 'summary', employeeId])` — kept
 *   (cross-key): the status change shifts monthly summary counters. The
 *   employee is read from the cached parent attendance when available,
 *   otherwise from the regularization's enriched `employeeId`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; status: 'APPROVED' | 'REJECTED'; approvedBy: string;
 *   rejectionReason?: string }`.
 */
export function useProcessRegularization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      approvedBy,
      rejectionReason,
    }: {
      id: number;
      status: 'APPROVED' | 'REJECTED';
      approvedBy: string;
      rejectionReason?: string;
    }) =>
      attendanceRegularizationService.process(
        id,
        status,
        approvedBy,
        rejectionReason
      ),
    onSuccess: (reg) => {
      // POST /attendance-regularizations/web/{id}/process → AttendanceRegularizationDto
      // (base DTO, merge to preserve enriched fields).
      queryClient.setQueryData<RegularizationDetail>(
        attendanceRegularizationKeys.detail(reg.id),
        (old) => (old ? mergePreservingNested(old, reg, ENRICHED_KEYS) : reg)
      );
      // Pending queue shrinks once a request is processed.
      queryClient.invalidateQueries({
        queryKey: attendanceRegularizationKeys.pending(),
      });
      // Processing a regularization flips the parent attendance status
      // (e.g. PENDING_REGULARIZATION → PRESENT). Refresh affected caches.
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.byId(reg.attendanceId),
      });
      queryClient.invalidateQueries({ predicate: isAttendanceListCache });
      // Cross-key: the underlying attendance's status change shifts monthly
      // summary counters (presentDays vs the pending bucket). Look up the
      // affected employee from the cached attendance detail when available;
      // otherwise fall back to the enriched employeeId on the regularization.
      const cachedAttendance = queryClient.getQueryData<Attendance>(
        attendanceKeys.byId(reg.attendanceId)
      );
      const employeeId = cachedAttendance?.employeeId ?? reg.employeeId;
      if (employeeId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: [...attendanceKeys.all, 'summary', employeeId],
        });
      }
    },
  });
}
