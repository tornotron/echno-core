/**
 * @module purchase-order-items-service
 *
 * Typed client for the purchase-order-items backend endpoints under
 * `/purchase-order-items`. Wraps `api.*` calls and parses raw JSON into
 * strongly-typed {@link PurchaseOrderItem} domain objects.
 *
 * Line items are a sub-resource of {@link PurchaseOrder}: the parent PO
 * already embeds an `items` array, so the typical UI flow reads items
 * through the parent and only calls this service for direct mutations.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  PurchaseOrderItem,
  parsePurchaseOrderItem,
  CreatePurchaseOrderItemRequest,
  UpdatePurchaseOrderItemRequest,
  createPurchaseOrderItemToJson,
  updatePurchaseOrderItemToJson,
} from '../types/purchase-orders';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   GET    /purchase-order-items/{id}                                → PurchaseOrderItemDto    (full)
 *   GET    /purchase-order-items/purchase-order/{purchaseOrderId}    → PurchaseOrderItemDto[]  (full; filtered by parent PO)
 *   GET    /purchase-order-items/material/{materialId}               → PurchaseOrderItemDto[]  (full; filtered by material)
 *   POST   /purchase-order-items                                     → PurchaseOrderItemDto    (full)
 *   PATCH  /purchase-order-items/web                                 → PurchaseOrderItemDto    (full; the id is in the body)
 *   DELETE /purchase-order-items/{id}                                → ApiResponse             (ack only)
 *
 * Note the URL base (`/purchase-order-items`) differs from the parent's
 * (`/purchase-orders/web`) — the read and create endpoints have no `/web`
 * segment. Update is the exception: the id-less family has no PATCH at
 * all, so it goes to `/purchase-order-items/web` with the id in the body.
 * Addressing it as `/purchase-order-items/{id}` matched no route and made
 * every line-item edit a 404.
 *
 * Mutations refresh the parent PO's embedded `items` array via the
 * mutation hooks rather than maintaining a parallel item cache.
 */

/**
 * Parses a single item payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link PurchaseOrderItem}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParsePurchaseOrderItem(data: Raw): PurchaseOrderItem {
  try {
    return parsePurchaseOrderItem(data);
  } catch (error) {
    logger.error('Failed to parse purchase order item:', error);
    throw new ApiError('Failed to process purchase order item data.', 422);
  }
}

export const purchaseOrderItemsService = {
  /**
   * Fetches a single line item by ID.
   *
   * `GET /purchase-order-items/{id}` → `PurchaseOrderItemDto` (full).
   *
   * @param id - Surrogate ID of the line item.
   * @returns The {@link PurchaseOrderItem}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getById(id: number): Promise<PurchaseOrderItem> {
    const data = await api.get<Raw>(`/purchase-order-items/${id}`);
    return safeParsePurchaseOrderItem(data);
  },

  /**
   * Fetches every line item belonging to the given parent PO. Returns
   * `[]` for any non-array response (defensive against backend shape
   * drift).
   *
   * `GET /purchase-order-items/purchase-order/{purchaseOrderId}` →
   * `PurchaseOrderItemDto[]` (full).
   *
   * @param purchaseOrderId - Surrogate ID of the parent
   *   {@link PurchaseOrder}.
   * @returns The matching {@link PurchaseOrderItem} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getByPurchaseOrder(
    purchaseOrderId: number
  ): Promise<PurchaseOrderItem[]> {
    const data = await api.get<Raw[]>(
      `/purchase-order-items/purchase-order/${purchaseOrderId}`
    );
    if (!Array.isArray(data)) return [];
    return data.map((item) => safeParsePurchaseOrderItem(item));
  },

  /**
   * Fetches every line item that references the given material across all
   * POs. Returns `[]` for any non-array response.
   *
   * `GET /purchase-order-items/material/{materialId}` →
   * `PurchaseOrderItemDto[]` (full).
   *
   * @param materialId - Surrogate ID of the {@link Material}.
   * @returns The matching {@link PurchaseOrderItem} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getByMaterial(materialId: number): Promise<PurchaseOrderItem[]> {
    const data = await api.get<Raw[]>(
      `/purchase-order-items/material/${materialId}`
    );
    if (!Array.isArray(data)) return [];
    return data.map((item) => safeParsePurchaseOrderItem(item));
  },

  /**
   * Adds a new line item to an existing PO.
   *
   * `POST /purchase-order-items` → `PurchaseOrderItemDto` (full).
   *
   * @param dto - The line item to create.
   * @returns The created {@link PurchaseOrderItem}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async create(
    dto: CreatePurchaseOrderItemRequest
  ): Promise<PurchaseOrderItem> {
    const data = await api.post<Raw>(
      '/purchase-order-items',
      createPurchaseOrderItemToJson(dto)
    );
    return safeParsePurchaseOrderItem(data);
  },

  /**
   * Updates a line item. The id travels in the body, where
   * `PurchaseOrderItemUpdateDto` requires it, rather than in the path.
   *
   * `PATCH /purchase-order-items/web` → `PurchaseOrderItemDto` (full).
   *
   * @param id - Surrogate ID of the line item to update.
   * @param dto - Fields to update; only set fields are sent.
   * @returns The updated {@link PurchaseOrderItem}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async update(
    id: number,
    dto: UpdatePurchaseOrderItemRequest
  ): Promise<PurchaseOrderItem> {
    const data = await api.patch<Raw>(
      '/purchase-order-items/web',
      updatePurchaseOrderItemToJson({ ...dto, id })
    );
    return safeParsePurchaseOrderItem(data);
  },

  /**
   * Deletes a line item.
   *
   * `DELETE /purchase-order-items/{id}` → `ApiResponse` (ack only).
   *
   * @param id - Surrogate ID of the line item.
   * @throws {ApiError} On non-2xx HTTP responses.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/purchase-order-items/${id}`);
  },
};
