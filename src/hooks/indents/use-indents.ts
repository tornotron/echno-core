/**
 * @module use-indents
 *
 * TanStack Query hooks for reading indents (material requisitions).
 * Mutations live in {@link useCreateIndent}, {@link useUpdateIndent},
 * and {@link useDeleteIndent}.
 *
 * None of the query hooks below spread a profile from `lib/query/options`;
 * they inherit the host `QueryClient`'s defaults (mirroring the
 * **standard** profile of `staleTime` 60 s / `gcTime` 5 min when the
 * host uses the recommended setup).
 */

import { useQuery } from '@tanstack/react-query';
import { indentsKeys } from './keys';
import { indentsService } from '../../services/indents-service';

/**
 * Fetches every indent (unpaginated).
 *
 * @returns A TanStack `UseQueryResult` wrapping `Indent[]`.
 */
export const useIndents = () =>
  useQuery({
    queryKey: indentsKeys.lists(),
    queryFn: () => indentsService.getAll(),
  });

/**
 * Fetches a page of indents.
 *
 * @param pageNo - Zero-based page number. Defaults to `0`.
 * @param pageSize - Number of indents per page. Defaults to `10`.
 * @returns A TanStack `UseQueryResult` wrapping `Indent[]` for the page.
 */
export const useIndentsPaginated = (pageNo = 0, pageSize = 10) =>
  useQuery({
    queryKey: indentsKeys.paginated(pageNo, pageSize),
    queryFn: () => indentsService.getAllPaginated(pageNo, pageSize),
  });

/**
 * Fetches a single indent by ID. The query is disabled until `id` is
 * truthy. This detail cache carries the embedded `items` array;
 * line-item mutations patch it in place.
 *
 * @param id - Surrogate ID of the indent. Pass `0` (or any falsy value)
 *   to defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single `Indent`.
 */
export const useIndent = (id: number) =>
  useQuery({
    queryKey: indentsKeys.detail(id),
    queryFn: () => indentsService.getById(id),
    enabled: !!id,
  });
export { indentsKeys } from './keys';
