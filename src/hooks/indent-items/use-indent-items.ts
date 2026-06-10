/**
 * @module use-indent-items
 *
 * TanStack Query hooks for reading indent line items. Mutations live in
 * {@link useCreateIndentItem}, {@link useUpdateIndentItem},
 * {@link useDeleteIndentItem}, and {@link useMarkIndentItemConverted}.
 *
 * None of the query hooks below spread a profile from `lib/query/options`;
 * they inherit the host `QueryClient`'s defaults (mirroring the
 * **standard** profile of `staleTime` 60 s / `gcTime` 5 min when the
 * host uses the recommended setup).
 */
import { useQuery } from '@tanstack/react-query';
import { indentItemsService } from '../../services/indent-items-service';
import { indentItemKeys } from './keys';

/**
 * Fetches every indent line item (unpaginated).
 *
 * @returns A TanStack `UseQueryResult` wrapping `IndentItem[]`.
 */
export const useIndentItems = () =>
  useQuery({
    queryKey: indentItemKeys.lists(),
    queryFn: () => indentItemsService.getAll(),
  });

/**
 * Fetches a single indent line item by ID. The query is disabled until
 * `id` is truthy.
 *
 * @param id - Surrogate ID of the line item. Pass `0` (or any falsy
 *   value) to defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single `IndentItem`.
 */
export const useIndentItem = (id: number) =>
  useQuery({
    queryKey: indentItemKeys.detail(id),
    queryFn: () => indentItemsService.getById(id),
    enabled: !!id,
  });

/**
 * Fetches every line item belonging to a given parent indent. The query
 * is disabled until `indentId` is truthy.
 *
 * @param indentId - Surrogate ID of the parent indent.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `IndentItem[]`.
 */
export const useIndentItemsByIndent = (indentId: number) =>
  useQuery({
    queryKey: indentItemKeys.byIndent(indentId),
    queryFn: () => indentItemsService.getByIndent(indentId),
    enabled: !!indentId,
  });
