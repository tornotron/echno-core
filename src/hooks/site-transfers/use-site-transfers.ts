/**
 * @module use-site-transfers
 *
 * TanStack Query hooks for reading site transfers. Mutations live in
 * {@link useCreateSiteTransfer}, {@link useUpdateSiteTransferStatus},
 * and the (deprecated) stub {@link useDeleteSiteTransfer}.
 *
 * None of the query hooks below spread a profile from
 * `lib/query/options`; they inherit the host `QueryClient`'s defaults
 * (mirroring the **standard** profile of `staleTime` 60 s / `gcTime`
 * 5 min when the host uses the recommended setup).
 */

import { useQuery } from '@tanstack/react-query';
import { siteTransfersService } from '../../services/site-transfers-service';
import { SiteTransferStatus } from '../../types/site-transfers';
import { siteTransferKeys } from './keys';

/**
 * Fetches every site transfer (unpaginated).
 *
 * @returns A TanStack `UseQueryResult` wrapping `SiteTransfer[]`.
 */
export const useSiteTransfers = () =>
  useQuery({
    queryKey: siteTransferKeys.lists(),
    queryFn: () => siteTransfersService.getAll(),
  });

/**
 * Fetches a page of site transfers.
 *
 * @param pageNo - Zero-based page number. Defaults to `0`.
 * @param pageSize - Number of transfers per page. Defaults to `10`.
 * @returns A TanStack `UseQueryResult` wrapping `SiteTransfer[]` for
 *   the page.
 */
export const useSiteTransfersPaginated = (pageNo = 0, pageSize = 10) =>
  useQuery({
    queryKey: siteTransferKeys.paginated(pageNo, pageSize),
    queryFn: () => siteTransfersService.getAllPaginated(pageNo, pageSize),
  });

/**
 * Fetches a single site transfer by ID. The query is disabled until
 * `id` is truthy. This detail cache carries the embedded `items` array.
 *
 * @param id - Surrogate ID of the transfer. Pass `0` (or any falsy
 *   value) to defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single
 *   `SiteTransfer`.
 */
export const useSiteTransfer = (id: number) =>
  useQuery({
    queryKey: siteTransferKeys.detail(id),
    queryFn: () => siteTransfersService.getById(id),
    enabled: !!id,
  });

/**
 * Fetches every site transfer currently in the given lifecycle state.
 * The query is disabled until `status` is truthy.
 *
 * @param status - The {@link SiteTransferStatus} bucket to filter by.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `SiteTransfer[]`.
 */
export const useSiteTransfersByStatus = (status: SiteTransferStatus) =>
  useQuery({
    queryKey: siteTransferKeys.byStatus(status),
    queryFn: () => siteTransfersService.getByStatus(status),
    enabled: !!status,
  });

/**
 * Fetches every site transfer originating from the given project. The
 * query is disabled until `projectId` is positive.
 *
 * @param projectId - Surrogate ID of the sending project.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `SiteTransfer[]`.
 */
export const useSiteTransfersBySendingProject = (projectId: number) =>
  useQuery({
    queryKey: siteTransferKeys.bySendingProject(projectId),
    queryFn: () => siteTransfersService.getBySendingProject(projectId),
    enabled: projectId > 0,
  });

/**
 * Fetches every site transfer destined for the given project. The
 * query is disabled until `projectId` is positive.
 *
 * @param projectId - Surrogate ID of the receiving project.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `SiteTransfer[]`.
 */
export const useSiteTransfersByReceivingProject = (projectId: number) =>
  useQuery({
    queryKey: siteTransferKeys.byReceivingProject(projectId),
    queryFn: () => siteTransfersService.getByReceivingProject(projectId),
    enabled: projectId > 0,
  });

export { siteTransferKeys } from './keys';
