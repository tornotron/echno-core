/**
 * @module indent-items-service
 *
 * Typed client for the indent-items backend endpoints under
 * `/indent-items/web`. Wraps `api.*` calls and parses raw JSON into
 * strongly-typed {@link IndentItem} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  IndentItem,
  parseIndentItem,
  CreateIndentItemRequest,
  UpdateIndentItemRequest,
  createIndentItemToJson,
  updateIndentItemToJson,
} from '../types/indents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   GET    /indent-items/web                                 → IndentItemDto[]  (full list)
 *   GET    /indent-items/web/{id}                            → IndentItemDto    (full)
 *   GET    /indent-items/web/indent/{indentId}               → IndentItemDto[]  (full; filtered server-side by parent indent)
 *   POST   /indent-items/web                                 → IndentItemDto    (full)
 *   PUT    /indent-items/web/{id}                            → IndentItemDto    (full)
 *   DELETE /indent-items/web/{id}                            → ApiResponse      (ack)
 *   PUT    /indent-items/web/{id}/mark-converted?purchaseOrderNumber → IndentItemDto (full; PO number comes from a query-string parameter, body empty)
 */

/**
 * Parses a single indent-item payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link IndentItem}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseIndentItem(data: Raw): IndentItem {
  try {
    return parseIndentItem(data);
  } catch (error) {
    logger.error('Failed to parse indent item:', error);
    throw new ApiError('Failed to process indent item data.', 422);
  }
}

export const indentItemsService = {
  /**
   * Fetches every indent line item unpaginated
   * (`GET /indent-items/web`). Returns `[]` if the backend response is
   * not an array.
   *
   * @returns Every {@link IndentItem} in the organisation.
   * @throws {ApiError} On a non-2xx response.
   */
  async getAll(): Promise<IndentItem[]> {
    const data = await api.get<Raw[]>('/indent-items/web');
    if (!Array.isArray(data)) return [];
    return data.map((item) => parseIndentItem(item));
  },

  /**
   * Fetches a single indent line item by ID
   * (`GET /indent-items/web/{id}`).
   *
   * @param id - Surrogate ID of the line item.
   * @returns The {@link IndentItem}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getById(id: number): Promise<IndentItem> {
    const data = await api.get<Raw>(`/indent-items/web/${id}`);
    return safeParseIndentItem(data);
  },

  /**
   * Fetches every line item belonging to a given parent indent
   * (`GET /indent-items/web/indent/{indentId}`). Returns `[]` if the
   * backend response is not an array.
   *
   * @param indentId - Surrogate ID of the parent indent.
   * @returns The matching {@link IndentItem}s.
   * @throws {ApiError} On a non-2xx response.
   */
  async getByIndent(indentId: number): Promise<IndentItem[]> {
    const data = await api.get<Raw[]>(`/indent-items/web/indent/${indentId}`);
    if (!Array.isArray(data)) return [];
    return data.map((item) => parseIndentItem(item));
  },

  /**
   * Creates a standalone indent line item (`POST /indent-items/web`).
   * Use the indent-create payload's embedded `items` array when
   * creating a parent and its lines in one round-trip.
   *
   * @param dto - The {@link CreateIndentItemRequest} payload.
   * @returns The newly-created {@link IndentItem}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async create(dto: CreateIndentItemRequest): Promise<IndentItem> {
    const data = await api.post<Raw>(
      '/indent-items/web',
      createIndentItemToJson(dto)
    );
    return safeParseIndentItem(data);
  },

  /**
   * Updates an indent line item (`PUT /indent-items/web/{id}`).
   *
   * @param id - Surrogate ID of the line item.
   * @param dto - The {@link UpdateIndentItemRequest} payload.
   * @returns The updated {@link IndentItem}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async update(id: number, dto: UpdateIndentItemRequest): Promise<IndentItem> {
    const data = await api.put<Raw>(
      `/indent-items/web/${id}`,
      updateIndentItemToJson(dto)
    );
    return safeParseIndentItem(data);
  },

  /**
   * Deletes an indent line item (`DELETE /indent-items/web/{id}`).
   * Response is an ack only.
   *
   * @param id - Surrogate ID of the line item to delete.
   * @throws {ApiError} On a non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/indent-items/web/${id}`);
  },

  /**
   * Flips a line item to the converted state and links it to the named
   * purchase order
   * (`PUT /indent-items/web/{id}/mark-converted?purchaseOrderNumber=…`).
   * The PO number travels as a query-string parameter; the request body
   * is empty.
   *
   * @param id - Surrogate ID of the line item.
   * @param purchaseOrderNumber - Human-readable PO number to record on
   *   the line.
   * @returns The updated {@link IndentItem} (with
   *   `convertedToPurchaseOrder: true` and `linkedPurchaseOrderNumber`
   *   populated).
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async markConverted(
    id: number,
    purchaseOrderNumber: string
  ): Promise<IndentItem> {
    const data = await api.put<Raw>(
      `/indent-items/web/${id}/mark-converted`,
      {},
      { purchaseOrderNumber }
    );
    return safeParseIndentItem(data);
  },
};
