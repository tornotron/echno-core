/**
 * @module grn-service
 *
 * Typed client for the goods-received-notes (GRN) backend endpoints
 * under `/grns/web`. Wraps `api.*` calls and parses raw JSON into
 * strongly-typed {@link GoodsReceivedNote} domain objects (each one
 * carrying its embedded {@link GrnItem} array).
 *
 * Posting a GRN is what increments material stock and writes the
 * corresponding inventory-transaction ledger entries as a server-side
 * side-effect. Hooks invalidate the materials-stock and
 * inventory-transactions namespaces on create accordingly.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  GoodsReceivedNote,
  CreateGrnRequest,
  createGrnToJson,
  UpdateGrnRequest,
  updateGrnToJson,
  parseGoodsReceivedNote,
} from '../types/grn';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   POST   /grns/web                                      → GoodsReceivedNoteDto    (full; items array embedded)
 *   GET    /grns/web                                      → GoodsReceivedNoteDto[]  (full list)
 *   GET    /grns/web/all?pageNo&pageSize                  → GoodsReceivedNoteDto[]  (paginated; returned as plain array, no envelope)
 *   GET    /grns/web/{id}                                 → GoodsReceivedNoteDto    (full)
 *   GET    /grns/web/vendor/{vendorId}                    → GoodsReceivedNoteDto[]  (full; filtered server-side by vendor)
 *   GET    /grns/web/date-range?startDate&endDate         → GoodsReceivedNoteDto[]  (full; filtered server-side by receivedOn range)
 *   PATCH  /grns/web                                      → GoodsReceivedNoteDto    (full; UpdateGrnRequest carries `id` in the body, not as a path param)
 *   DELETE /grns/web/{id}                                 → (not implemented server-side)
 *
 * Backend has no DELETE endpoint — {@link useDeleteGRN} fails fast
 * rather than issuing a request.
 */

/**
 * Parses a single GRN payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link GoodsReceivedNote}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseGRN(data: Raw): GoodsReceivedNote {
  try {
    return parseGoodsReceivedNote(data);
  } catch (error) {
    logger.error('Failed to parse GRN:', error);
    throw new ApiError('Failed to process GRN data.', 422);
  }
}

/**
 * Parses an array of GRN payloads. Rejects non-array input loudly with
 * an {@link ApiError} rather than coercing to `[]`, since the list
 * endpoints are documented to always return arrays.
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link GoodsReceivedNote} objects.
 * @throws {ApiError} When `data` is not an array, or when any item
 *   fails parsing (HTTP 422).
 */
function safeParseGRNs(data: Raw[]): GoodsReceivedNote[] {
  if (!Array.isArray(data)) {
    logger.error('safeParseGRNs: expected array, received:', typeof data);
    throw new ApiError('Invalid response: expected array of GRN records.', 422);
  }
  try {
    return data.map((item) => parseGoodsReceivedNote(item));
  } catch (error) {
    logger.error('Failed to parse GRNs:', error);
    throw new ApiError('Failed to process GRNs data.', 422);
  }
}

export const grnService = {
  /**
   * Creates a new GRN together with its line items (`POST /grns/web`).
   * Posting the GRN increments material stock and writes
   * inventory-transaction ledger entries server-side.
   *
   * @param dto - The {@link CreateGrnRequest} payload.
   * @returns The newly-created {@link GoodsReceivedNote} with embedded
   *   items.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async create(dto: CreateGrnRequest): Promise<GoodsReceivedNote> {
    const data = await api.post<Raw>('/grns/web', createGrnToJson(dto));
    return safeParseGRN(data);
  },

  /**
   * Fetches every GRN unpaginated (`GET /grns/web`).
   *
   * @returns Every {@link GoodsReceivedNote} in the organisation.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAll(): Promise<GoodsReceivedNote[]> {
    const data = await api.get<Raw[]>('/grns/web');
    return safeParseGRNs(data);
  },

  /**
   * Fetches a page of GRNs (`GET /grns/web/all`). The backend returns
   * a plain array (no envelope); pagination metadata is not exposed.
   *
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of GRNs per page. Defaults to `10`.
   * @returns The {@link GoodsReceivedNote}s for the requested page.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAllPaginated(
    pageNo = 0,
    pageSize = 10
  ): Promise<GoodsReceivedNote[]> {
    const data = await api.get<Raw[]>('/grns/web/all', { pageNo, pageSize });
    return safeParseGRNs(data);
  },

  /**
   * Fetches a single GRN by ID (`GET /grns/web/{id}`).
   *
   * @param id - Surrogate ID of the GRN.
   * @returns The {@link GoodsReceivedNote} with embedded items.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getById(id: number): Promise<GoodsReceivedNote> {
    const data = await api.get<Raw>(`/grns/web/${id}`);
    return safeParseGRN(data);
  },

  /**
   * Fetches every GRN received from a given vendor
   * (`GET /grns/web/vendor/{vendorId}`).
   *
   * @param vendorId - Surrogate ID of the vendor.
   * @returns The matching {@link GoodsReceivedNote}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getByVendor(vendorId: number): Promise<GoodsReceivedNote[]> {
    const data = await api.get<Raw[]>(`/grns/web/vendor/${vendorId}`);
    return safeParseGRNs(data);
  },

  /**
   * Fetches every GRN whose `receivedOn` falls within an inclusive
   * ISO-8601 date range (`GET /grns/web/date-range`).
   *
   * @param startDate - ISO 8601 lower bound (inclusive).
   * @param endDate - ISO 8601 upper bound (inclusive).
   * @returns The matching {@link GoodsReceivedNote}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<GoodsReceivedNote[]> {
    const data = await api.get<Raw[]>('/grns/web/date-range', {
      startDate,
      endDate,
    });
    return safeParseGRNs(data);
  },

  /**
   * Updates a GRN's header fields (`PATCH /grns/web`). The surrogate
   * `id` travels in the request body. Line items cannot be edited via
   * this endpoint.
   *
   * @param dto - The {@link UpdateGrnRequest} payload (carries `id`).
   * @returns The updated {@link GoodsReceivedNote}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async update(dto: UpdateGrnRequest): Promise<GoodsReceivedNote> {
    const data = await api.patch<Raw>('/grns/web', updateGrnToJson(dto));
    return safeParseGRN(data);
  },

  /**
   * Deletes a GRN (`DELETE /grns/web/{id}`).
   *
   * Not implemented server-side. Reaching this method results in a
   * 404 from the API; see {@link useDeleteGRN} for the frontend-side
   * fail-fast wrapper.
   *
   * @param id - Surrogate ID of the GRN to delete.
   * @throws {ApiError} On a non-2xx response (always, until the
   *   endpoint is implemented).
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/grns/web/${id}`);
  },
};
