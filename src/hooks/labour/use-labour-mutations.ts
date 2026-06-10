import { useMutation, useQueryClient } from '@tanstack/react-query';
import { labourService } from '../../services/labour-service';
import { labourKeys } from './labour-keys';
import type {
  Labour,
  LabourCreateRequest,
  LabourUpdateRequest,
} from '../../types/labour';
import { logger } from '../../lib/logger';

function isLabourListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return Array.isArray(key) && key[0] === 'labour' && key[1] !== 'detail';
}

export function useCreateLabour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LabourCreateRequest) => labourService.create(data),
    onSuccess: (newLabour) => {
      // POST /labour/web → LabourSimpleDto (Rule B, partial). Labour is a flat
      // type with no nested arrays, so merging degenerates to overwrite — but
      // the SimpleDto may omit scalar fields the full LabourDto returns
      // (`labourID` casing, `emergencyContactPhone` vs `emergencyContactNumber`,
      // plus the org/project context naming). Seed list + detail with the
      // SimpleDto, then invalidate detail so the next observer pulls the
      // canonical LabourDto from GET /labour/web/{id}.
      queryClient.setQueryData<Labour[]>(labourKeys.lists(), (old) =>
        old ? [...old, newLabour] : [newLabour]
      );
      queryClient.setQueryData<Labour>(
        labourKeys.detail(newLabour.id),
        newLabour
      );
      queryClient.invalidateQueries({
        queryKey: labourKeys.detail(newLabour.id),
      });
    },
    onError: (error) => {
      logger.error('Failed to create labour:', {
        message: error instanceof Error ? error.message : String(error),
        errors:
          error instanceof Error && 'errors' in error
            ? (error as { errors?: unknown }).errors
            : undefined,
      });
    },
  });
}

export function useUpdateLabour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: LabourUpdateRequest }) =>
      labourService.update(id, data),
    onSuccess: (_void, { id }) => {
      // PATCH /labour/web/{id} → ApiResponse (ack) — invalidate to refetch.
      queryClient.invalidateQueries({ queryKey: labourKeys.detail(id) });
      queryClient.invalidateQueries({ predicate: isLabourListCache });
    },
    onError: (error) => {
      logger.error('Failed to update labour:', error);
    },
  });
}

export function useDeleteLabour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => labourService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: labourKeys.detail(id) });
      await queryClient.cancelQueries({ predicate: isLabourListCache });

      const previousDetail = queryClient.getQueryData<Labour>(
        labourKeys.detail(id)
      );
      const previousListEntries = queryClient.getQueriesData<Labour[]>({
        predicate: isLabourListCache,
      });

      queryClient.setQueriesData<Labour[]>(
        { predicate: isLabourListCache },
        (old) => old?.filter((l) => l.id !== id)
      );
      queryClient.removeQueries({ queryKey: labourKeys.detail(id) });

      return { previousDetail, previousListEntries };
    },
    onError: (error, id, context) => {
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Labour[]>(key, value);
      }
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Labour>(
          labourKeys.detail(id),
          context.previousDetail
        );
      }
      logger.error('Failed to delete labour:', error);
    },
  });
}
