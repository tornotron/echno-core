/**
 * @module use-grn
 *
 * TanStack Query hooks for reading goods-received notes (GRNs).
 * Mutations live in {@link useCreateGRN}, {@link useUpdateGRN}, and the
 * (deprecated) stub {@link useDeleteGRN}.
 *
 * None of the query hooks below spread a profile from
 * `lib/query/options`; they inherit the host `QueryClient`'s defaults
 * (mirroring the **standard** profile of `staleTime` 60 s / `gcTime`
 * 5 min when the host uses the recommended setup).
 */

import { useQuery } from '@tanstack/react-query';
import { grnService } from '../../services/grn-service';
import { grnKeys } from './keys';

/**
 * Fetches every GRN (unpaginated).
 *
 * @returns A TanStack `UseQueryResult` wrapping `GoodsReceivedNote[]`.
 */
export const useGRNs = () =>
  useQuery({
    queryKey: grnKeys.lists(),
    queryFn: () => grnService.getAll(),
  });

/**
 * Fetches a page of GRNs.
 *
 * @param pageNo - Zero-based page number. Defaults to `0`.
 * @param pageSize - Number of GRNs per page. Defaults to `10`.
 * @returns A TanStack `UseQueryResult` wrapping `GoodsReceivedNote[]`
 *   for the page.
 */
export const useGRNsPaginated = (pageNo = 0, pageSize = 10) =>
  useQuery({
    queryKey: grnKeys.paginated(pageNo, pageSize),
    queryFn: () => grnService.getAllPaginated(pageNo, pageSize),
  });

/**
 * Fetches a single GRN by ID. The query is disabled until `id` is
 * truthy. This detail cache carries the embedded `items` array.
 *
 * @param id - Surrogate ID of the GRN. Pass `0` (or any falsy value)
 *   to defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single
 *   `GoodsReceivedNote`.
 */
export const useGRN = (id: number) =>
  useQuery({
    queryKey: grnKeys.detail(id),
    queryFn: () => grnService.getById(id),
    enabled: !!id,
  });

/**
 * Fetches every GRN received from a given vendor. The query is
 * disabled until `vendorId` is truthy.
 *
 * @param vendorId - Surrogate ID of the vendor.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `GoodsReceivedNote[]`.
 */
export const useGRNsByVendor = (vendorId: number) =>
  useQuery({
    queryKey: grnKeys.byVendor(vendorId),
    queryFn: () => grnService.getByVendor(vendorId),
    enabled: !!vendorId,
  });

/**
 * Fetches every GRN whose `receivedOn` falls within an inclusive
 * ISO-8601 date range. The query is disabled until both dates are
 * truthy.
 *
 * @param startDate - ISO 8601 lower bound (inclusive).
 * @param endDate - ISO 8601 upper bound (inclusive).
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `GoodsReceivedNote[]`.
 */
export const useGRNsByDateRange = (startDate: string, endDate: string) =>
  useQuery({
    queryKey: grnKeys.byDateRange(startDate, endDate),
    queryFn: () => grnService.getByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

export { grnKeys } from './keys';
