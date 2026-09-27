/**
 * @module use-work-progress-mutations
 *
 * Mutation hooks for the Work Progress module. Recording an inspection
 * changes its activity, so each mutation invalidates the schedule prefix
 * as well as this domain's.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workProgressService } from '../../services/work-progress-service';
import type { RegisterUploadRequest } from '../../types/attachment';
import type { RecordProgressInspectionRequest } from '../../types/work-progress/work-progress';
import { wbsKeys } from '../wbs/keys';
import { workProgressKeys } from './keys';

function useInvalidateWorkProgress() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: workProgressKeys.all }),
      queryClient.invalidateQueries({ queryKey: wbsKeys.all }),
    ]);
}

/** Records a progress inspection. Mutate with the request. */
export function useRecordProgressInspection() {
  const invalidate = useInvalidateWorkProgress();
  return useMutation({
    mutationFn: (req: RecordProgressInspectionRequest) => workProgressService.record(req),
    onSuccess: invalidate,
  });
}

/** Registers uploaded evidence on a record. Mutate with `{ id, uploads }`. */
export function useRegisterProgressInspectionEvidence() {
  const invalidate = useInvalidateWorkProgress();
  return useMutation({
    mutationFn: ({ id, uploads }: { id: string; uploads: RegisterUploadRequest[] }) =>
      workProgressService.registerEvidence(id, uploads),
    onSuccess: invalidate,
  });
}
