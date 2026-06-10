/**
 * @module use-labour
 *
 * TanStack Query hooks for reading labour records. Mutations live in
 * {@link useCreateLabour}, {@link useUpdateLabour}, and
 * {@link useDeleteLabour}.
 */
import { useQuery } from '@tanstack/react-query';
import { labourService } from '../../services/labour-service';
import { labourKeys } from './keys';
import { standardQueryOptions } from '../../lib/query/options';

/**
 * Fetches every labour record.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min,
 * `refetchOnWindowFocus` in production only).
 *
 * @returns A TanStack `UseQueryResult` wrapping `Labour[]`.
 */
export const useLabour = () =>
  useQuery({
    ...standardQueryOptions,
    queryKey: labourKeys.lists(),
    queryFn: () => labourService.getAll(),
  });

/**
 * Fetches a single labour record by ID.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min,
 * `refetchOnWindowFocus` in production only). The query is disabled until
 * `id` is a positive finite number.
 *
 * @param id - Surrogate ID of the labour record. The query stays disabled
 *   while `id` is non-finite or non-positive.
 * @returns A TanStack `UseQueryResult` wrapping a single `Labour`.
 */
export const useLabourById = (id: number) =>
  useQuery({
    ...standardQueryOptions,
    queryKey: labourKeys.detail(id),
    queryFn: () => labourService.getById(id),
    enabled: Number.isFinite(id) && id > 0,
  });
