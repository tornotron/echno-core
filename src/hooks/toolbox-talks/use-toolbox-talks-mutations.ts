/**
 * @module use-toolbox-talks-mutations
 *
 * Mutation hooks for the Toolbox Talks domain. Each invalidates the
 * domain prefix on success, so every list page and open detail refetch
 * together.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toolboxTalksService } from '../../services/toolbox-talks-service';
import type { RegisterUploadRequest } from '../../types/attachment';
import {
  CreateToolboxTalkRequest,
  ToolboxTalkAttendeesRequest,
  UpdateToolboxTalkRequest,
} from '../../types/toolbox-talks/toolbox-talks';
import { toolboxTalksKeys } from './keys';

function useInvalidateToolboxTalks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: toolboxTalksKeys.all });
}

/** Drafts a talk. Mutate with the {@link CreateToolboxTalkRequest}. */
export function useCreateToolboxTalk() {
  const invalidate = useInvalidateToolboxTalks();
  return useMutation({
    mutationFn: (req: CreateToolboxTalkRequest) => toolboxTalksService.create(req),
    onSuccess: invalidate,
  });
}

/** Changes a draft. Mutate with `{ id, data }`. */
export function useUpdateToolboxTalk() {
  const invalidate = useInvalidateToolboxTalks();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateToolboxTalkRequest }) =>
      toolboxTalksService.update(id, data),
    onSuccess: invalidate,
  });
}

/** Adds attendees to a draft. Mutate with `{ id, data }`. */
export function useAddToolboxTalkAttendees() {
  const invalidate = useInvalidateToolboxTalks();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ToolboxTalkAttendeesRequest }) =>
      toolboxTalksService.addAttendees(id, data),
    onSuccess: invalidate,
  });
}

/** Removes one attendee from a draft. Mutate with `{ id, employeeId }`. */
export function useRemoveToolboxTalkAttendee() {
  const invalidate = useInvalidateToolboxTalks();
  return useMutation({
    mutationFn: ({ id, employeeId }: { id: string; employeeId: number }) =>
      toolboxTalksService.removeAttendee(id, employeeId),
    onSuccess: invalidate,
  });
}

/** Records a draft. Mutate with the talk id. */
export function useRecordToolboxTalk() {
  const invalidate = useInvalidateToolboxTalks();
  return useMutation({
    mutationFn: (id: string) => toolboxTalksService.record(id),
    onSuccess: invalidate,
  });
}

/**
 * Registers uploaded photo keys on a talk (step 3 of the presigned flow;
 * presign and the PUT happen in the caller). Mutate with `{ id, data }`.
 */
export function useRegisterToolboxTalkPhotos() {
  const invalidate = useInvalidateToolboxTalks();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RegisterUploadRequest[] }) =>
      toolboxTalksService.registerPhotos(id, data),
    onSuccess: invalidate,
  });
}
