/**
 * @module hooks/movement/use-movement-mutations
 *
 * React Query mutation hooks for movement records: {@link useLogMovement} and
 * {@link useVerifyMovement}.
 *
 * Cache discipline: both endpoints return the full `MovementRecordDto`, so the
 * per-attendance list cache is patched directly and the UI reflects the write
 * without a refetch. The parent attendance (owned by the attendance module)
 * embeds `Attendance.movements`, so {@link patchMovementInParentAttendance}
 * also patches that array in place; if the parent attendance is uncached the
 * patch is skipped and the next observer-driven fetch reconciles it.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { movementService } from '../../services/movement-service';
import type {
  Attendance,
  CreateMovementRequest,
  MovementRecord,
} from '../../types/attendance';
import { movementKeys } from './keys';
import { attendanceKeys } from '../attendance';

/**
 * Insert / replace a movement record in the parent attendance's `movements`
 * array. Used by both create and verify so the embedded list stays in sync
 * without invalidating the parent attendance detail.
 */
function patchMovementInParentAttendance(
  queryClient: ReturnType<typeof useQueryClient>,
  movement: MovementRecord
) {
  queryClient.setQueryData<Attendance>(
    attendanceKeys.byId(movement.attendanceId),
    (old) => {
      if (!old) return old;
      const existing = old.movements ?? [];
      const idx = existing.findIndex((m) => m.id === movement.id);
      const movements =
        idx === -1
          ? [...existing, movement]
          : existing.map((m) => (m.id === movement.id ? movement : m));
      return { ...old, movements };
    }
  );
}

/**
 * Logs a new off-site movement against an attendance day.
 *
 * Backend response: `MovementRecordDto` (full).
 *
 * On success:
 * - `setQueryData(movementKeys.byAttendance(attendanceId), append)` — appends
 *   the record to the per-attendance movement list when that cache exists.
 * - {@link patchMovementInParentAttendance} — (cross-namespace: movement →
 *   attendance) inserts the record into the parent `Attendance.movements`
 *   array so the parent detail need not refetch.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ req: CreateMovementRequest; employeeId: number }`.
 */
export function useLogMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      req,
      employeeId,
    }: {
      req: CreateMovementRequest;
      employeeId: number;
    }) => movementService.logMovement(req, employeeId),
    onSuccess: (movement) => {
      // POST /movement-records/web → MovementRecordDto (full).
      queryClient.setQueryData<MovementRecord[]>(
        movementKeys.byAttendance(movement.attendanceId),
        (old) => (old ? [...old, movement] : undefined)
      );
      // Cross-namespace (movement → attendance): the parent Attendance.movements
      // array mirrors this child entity, so patch in place to avoid a parent
      // detail refetch.
      patchMovementInParentAttendance(queryClient, movement);
    },
  });
}

/**
 * Marks a movement record as verified.
 *
 * Backend response: `MovementRecordDto` (full).
 *
 * **The verifier is not an argument.** echno-backend#635 removed the
 * `verifiedBy` request parameter and now resolves the verifier from the
 * session, so the caller has nothing to supply beyond the id and nothing to
 * wait for before enabling the action.
 *
 * Verification can be refused, which it could not before: the backend answers
 * 400 when the movement is already verified, when the caller is the employee
 * the movement belongs to, and when the session resolves to no user of the
 * organization. Callers should render the `ApiError` message rather than a
 * fixed string, because all three read as the same failure otherwise.
 *
 * On success:
 * - `setQueryData(movementKeys.detail(id), movement)` — replaces the detail
 *   cache with the verified record.
 * - `setQueryData(movementKeys.byAttendance(attendanceId), replace)` — replaces
 *   the record in the per-attendance list when that cache exists.
 * - {@link patchMovementInParentAttendance} — (cross-namespace: movement →
 *   attendance) mirrors the flipped `isVerified` / `verifiedBy` /
 *   `verifiedById` / `verifiedAt` fields into the cached parent's movements
 *   array. The parent attendance's own status is unaffected, so no parent-key
 *   invalidation is needed.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number }`.
 */
export function useVerifyMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => movementService.verifyMovement(id),
    onSuccess: (movement) => {
      // POST /movement-records/web/{id}/verify → MovementRecordDto (full).
      queryClient.setQueryData<MovementRecord>(
        movementKeys.detail(movement.id),
        movement
      );
      queryClient.setQueryData<MovementRecord[]>(
        movementKeys.byAttendance(movement.attendanceId),
        (old) => old?.map((m) => (m.id === movement.id ? movement : m))
      );
      // Cross-namespace (movement → attendance): verification flips the child's
      // `isVerified` / `verifiedBy` / `verifiedById` / `verifiedAt` fields;
      // mirror those into the cached parent's movements array. Status of the
      // parent attendance itself does not change, so no parent-key
      // invalidation is needed.
      patchMovementInParentAttendance(queryClient, movement);
    },
  });
}
