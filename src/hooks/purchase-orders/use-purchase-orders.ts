/**
 * @module use-purchase-orders
 *
 * TanStack Query hooks for reading purchase orders. Mutations live in
 * {@link useCreatePurchaseOrder}, {@link useUpdatePurchaseOrder},
 * {@link useUpdatePOStatus}, and the (deprecated) stub
 * {@link useDeletePurchaseOrder}.
 *
 * None of the query hooks below spread a profile from `lib/query/options`;
 * they inherit the host `QueryClient`'s defaults (mirroring the
 * **standard** profile of `staleTime` 60 s / `gcTime` 5 min when the host
 * uses the recommended setup).
 */
import { useQuery } from '@tanstack/react-query';
import { purchaseOrdersService } from '../../services/purchase-orders-service';
import { PurchaseOrderStatus } from '../../types/purchase-orders';
import { poKeys } from './purchase-order-keys';

/**
 * Fetches every purchase order (unpaginated).
 *
 * @returns A TanStack `UseQueryResult` wrapping `PurchaseOrder[]`.
 */
export const usePurchaseOrders = () =>
  useQuery({
    queryKey: poKeys.lists(),
    queryFn: () => purchaseOrdersService.getAll(),
  });

/**
 * Fetches a page of purchase orders.
 *
 * @param pageNo - Zero-based page number. Defaults to `0`.
 * @param pageSize - Number of POs per page. Defaults to `10`.
 * @returns A TanStack `UseQueryResult` wrapping `PurchaseOrder[]` for the
 *   page.
 */
export const usePurchaseOrdersPaginated = (pageNo = 0, pageSize = 10) =>
  useQuery({
    queryKey: poKeys.paginated(pageNo, pageSize),
    queryFn: () => purchaseOrdersService.getAllPaginated(pageNo, pageSize),
  });

/**
 * Fetches a single purchase order by ID. The query is disabled until `id`
 * is truthy. This detail cache carries the embedded `items` array;
 * line-item mutations patch it in place.
 *
 * @param id - Surrogate ID of the PO. Pass `0` (or any falsy value) to
 *   defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single `PurchaseOrder`.
 */
export const usePurchaseOrder = (id: number) =>
  useQuery({
    queryKey: poKeys.detail(id),
    queryFn: () => purchaseOrdersService.getById(id),
    enabled: !!id,
  });

/**
 * Fetches every purchase order issued to the given vendor. The query is
 * disabled until `vendorId` is truthy.
 *
 * @param vendorId - Surrogate ID of the vendor.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `PurchaseOrder[]`.
 */
export const usePOsByVendor = (vendorId: number) =>
  useQuery({
    queryKey: poKeys.byVendor(vendorId),
    queryFn: () => purchaseOrdersService.getByVendor(vendorId),
    enabled: !!vendorId,
  });

/**
 * Fetches every purchase order originating from the given indent. The
 * query is disabled until `indentId` is truthy.
 *
 * @param indentId - Surrogate ID of the indent.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `PurchaseOrder[]`.
 */
export const usePOsByIndent = (indentId: number) =>
  useQuery({
    queryKey: poKeys.byIndent(indentId),
    queryFn: () => purchaseOrdersService.getByIndent(indentId),
    enabled: !!indentId,
  });

/**
 * Fetches every purchase order currently in the given lifecycle state.
 * The query is disabled until `status` is truthy.
 *
 * @param status - The {@link PurchaseOrderStatus} to filter by.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `PurchaseOrder[]`.
 */
export const usePOsByStatus = (status: PurchaseOrderStatus) =>
  useQuery({
    queryKey: poKeys.byStatus(status),
    queryFn: () => purchaseOrdersService.getByStatus(status),
    enabled: !!status,
  });

export { poKeys } from './purchase-order-keys';
