/**
 * @module purchase-orders-service
 *
 * Typed client for the purchase-orders backend endpoints under
 * `/purchase-orders/web`. Wraps `api.*` calls and parses raw JSON into
 * strongly-typed {@link PurchaseOrder} domain objects (each one carrying
 * its embedded {@link PurchaseOrderItem} array).
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from './../lib/logger';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  parsePurchaseOrder,
  CreatePurchaseOrderRequest,
  UpdatePurchaseOrderRequest,
  createPurchaseOrderToJson,
  updatePurchaseOrderToJson,
} from '../types/purchase-orders';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   POST   /purchase-orders/web                              → PurchaseOrderDto    (full; items array embedded)
 *   GET    /purchase-orders/web                              → PurchaseOrderDto[]  (full list)
 *   GET    /purchase-orders/web/all?pageNo&pageSize          → PurchaseOrderDto[]  (paginated; returned as plain array, no envelope)
 *   GET    /purchase-orders/web/{id}                         → PurchaseOrderDto    (full)
 *   GET    /purchase-orders/web/vendor/{vendorId}            → PurchaseOrderDto[]  (full; filtered server-side by vendor)
 *   GET    /purchase-orders/web/indent/{indentId}            → PurchaseOrderDto[]  (full; filtered server-side by indent)
 *   GET    /purchase-orders/web/status/{status}              → PurchaseOrderDto[]  (full; filtered server-side by status)
 *   PATCH  /purchase-orders/web/{id}                         → PurchaseOrderDto    (full; UpdatePurchaseOrderRequest carries `id` in body too)
 *   PATCH  /purchase-orders/web/{id}/status?status           → ApiResponse         (ack per spec; status comes from a query-string parameter, body empty)
 *   DELETE /purchase-orders/web/{id}                         → (not implemented server-side)
 *
 * The PATCH status endpoint's spec-defined response is `ApiResponse`, but
 * the service parses it through {@link parsePurchaseOrder} on the
 * tolerant assumption the server may upgrade to returning the full
 * entity. The status mutation hook ({@link useUpdatePOStatus}) guards
 * against both shapes at runtime.
 *
 * Backend has no DELETE endpoint — {@link useDeletePurchaseOrder} fails
 * fast rather than issuing a request.
 */

/**
 * Parses a single purchase-order payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link PurchaseOrder}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParsePurchaseOrder(data: Raw): PurchaseOrder {
  try {
    return parsePurchaseOrder(data);
  } catch (error) {
    logger.error('Failed to parse purchase order:', error);
    throw new ApiError('Failed to process purchase order data.', 422);
  }
}

/**
 * Parses an array of purchase-order payloads. Returns `[]` for any
 * non-array input (defensive against backend shape drift).
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link PurchaseOrder} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParsePurchaseOrders(data: Raw[]): PurchaseOrder[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parsePurchaseOrder(item));
  } catch (error) {
    logger.error('Failed to parse purchase orders:', error);
    throw new ApiError('Failed to process purchase orders data.', 422);
  }
}

export const purchaseOrdersService = {
  /**
   * Creates a new purchase order together with its line items in one
   * round-trip.
   *
   * `POST /purchase-orders/web` → `PurchaseOrderDto` (full, with `items`
   * array populated).
   *
   * @param dto - The PO and inline line items to create.
   * @returns The created {@link PurchaseOrder}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async create(dto: CreatePurchaseOrderRequest): Promise<PurchaseOrder> {
    const data = await api.post<Raw>(
      '/purchase-orders/web',
      createPurchaseOrderToJson(dto)
    );
    return safeParsePurchaseOrder(data);
  },

  /**
   * Fetches every purchase order (unpaginated).
   *
   * `GET /purchase-orders/web` → `PurchaseOrderDto[]` (full).
   *
   * @returns An array of {@link PurchaseOrder} objects.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getAll(): Promise<PurchaseOrder[]> {
    const data = await api.get<Raw[]>('/purchase-orders/web');
    return safeParsePurchaseOrders(data);
  },

  /**
   * Fetches a page of purchase orders. The backend returns a plain array
   * for this endpoint (no paged envelope).
   *
   * `GET /purchase-orders/web/all?pageNo&pageSize` →
   * `PurchaseOrderDto[]` (full).
   *
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of POs per page. Defaults to `10`.
   * @returns An array of {@link PurchaseOrder} objects for the page.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getAllPaginated(pageNo = 0, pageSize = 10): Promise<PurchaseOrder[]> {
    const data = await api.get<Raw[]>('/purchase-orders/web/all', {
      pageNo,
      pageSize,
    });
    return safeParsePurchaseOrders(data);
  },

  /**
   * Fetches a single purchase order by ID.
   *
   * `GET /purchase-orders/web/{id}` → `PurchaseOrderDto` (full).
   *
   * @param id - Surrogate ID of the PO.
   * @returns The {@link PurchaseOrder}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getById(id: number): Promise<PurchaseOrder> {
    const data = await api.get<Raw>(`/purchase-orders/web/${id}`);
    return safeParsePurchaseOrder(data);
  },

  /**
   * Fetches every purchase order issued to the given vendor.
   *
   * `GET /purchase-orders/web/vendor/{vendorId}` →
   * `PurchaseOrderDto[]` (full).
   *
   * @param vendorId - Surrogate ID of the vendor.
   * @returns The matching {@link PurchaseOrder} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getByVendor(vendorId: number): Promise<PurchaseOrder[]> {
    const data = await api.get<Raw[]>(
      `/purchase-orders/web/vendor/${vendorId}`
    );
    return safeParsePurchaseOrders(data);
  },

  /**
   * Fetches every purchase order originating from the given indent.
   *
   * `GET /purchase-orders/web/indent/{indentId}` →
   * `PurchaseOrderDto[]` (full).
   *
   * @param indentId - Surrogate ID of the indent.
   * @returns The matching {@link PurchaseOrder} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getByIndent(indentId: number): Promise<PurchaseOrder[]> {
    const data = await api.get<Raw[]>(
      `/purchase-orders/web/indent/${indentId}`
    );
    return safeParsePurchaseOrders(data);
  },

  /**
   * Fetches every purchase order currently in the given lifecycle state.
   *
   * `GET /purchase-orders/web/status/{status}` →
   * `PurchaseOrderDto[]` (full).
   *
   * @param status - The {@link PurchaseOrderStatus} to filter by.
   * @returns The matching {@link PurchaseOrder} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getByStatus(status: PurchaseOrderStatus): Promise<PurchaseOrder[]> {
    const data = await api.get<Raw[]>(`/purchase-orders/web/status/${status}`);
    return safeParsePurchaseOrders(data);
  },

  /**
   * Updates a purchase order. Sends `id` in both the URL path and the
   * request body — the backend reads it from the body.
   *
   * `PATCH /purchase-orders/web/{id}` → `PurchaseOrderDto` (full).
   *
   * @param dto - The patch request. Must include `id`.
   * @returns The updated {@link PurchaseOrder}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async update(dto: UpdatePurchaseOrderRequest): Promise<PurchaseOrder> {
    const data = await api.patch<Raw>(
      `/purchase-orders/web/${dto.id}`,
      updatePurchaseOrderToJson(dto)
    );
    return safeParsePurchaseOrder(data);
  },

  /**
   * Transitions a purchase order to a new lifecycle state. The new status
   * is sent as a query-string parameter; the request body is empty.
   *
   * `PATCH /purchase-orders/web/{id}/status?status={status}` → spec
   * defines `ApiResponse` (ack only) but the parser tolerates a full
   * `PurchaseOrderDto` for forward-compatibility. {@link useUpdatePOStatus}
   * guards against both shapes at the cache layer.
   *
   * @param id - Surrogate ID of the PO.
   * @param status - The target {@link PurchaseOrderStatus}.
   * @returns The updated {@link PurchaseOrder} if the backend returns the
   *   full entity; otherwise the parser may produce a partially-populated
   *   object — see the guard in {@link useUpdatePOStatus}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async updateStatus(
    id: number,
    status: PurchaseOrderStatus
  ): Promise<PurchaseOrder> {
    const data = await api.patch<Raw>(
      `/purchase-orders/web/${id}/status`,
      {},
      { status }
    );
    return safeParsePurchaseOrder(data);
  },

  /**
   * Deletes a purchase order.
   *
   * `DELETE /purchase-orders/web/{id}` — **not implemented server-side**.
   * Calling this method issues the request and will produce a 404; use
   * a status transition to {@link PurchaseOrderStatus.cancelled} via
   * {@link useUpdatePOStatus} instead. The companion hook
   * {@link useDeletePurchaseOrder} fails fast with a clear message rather
   * than hitting the backend.
   *
   * @param id - Surrogate ID of the PO to delete.
   * @throws {ApiError} Will produce a 404 since the endpoint does not exist.
   * @deprecated Backend does not expose a delete endpoint; use a status
   *   transition to `CANCELLED` instead.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/purchase-orders/web/${id}`);
  },
};
