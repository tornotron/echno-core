/**
 * @module site-transfers-service
 *
 * Typed client for the site-transfers backend endpoints under
 * `/site-transfers/web`. Wraps `api.*` calls and parses raw JSON into
 * strongly-typed {@link SiteTransfer} domain objects (each one
 * carrying its embedded {@link SiteTransferItem} array).
 *
 * Posting a transfer decrements stock at the sending location
 * server-side; a status transition to
 * {@link SiteTransferStatus.completed} increments destination stock.
 * Each side-effect writes inventory-transaction ledger entries. Hooks
 * invalidate the materials-stock and inventory-transactions namespaces
 * accordingly.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  SiteTransfer,
  SiteTransferStatus,
  CreateSiteTransferRequest,
  createSiteTransferToJson,
  parseSiteTransfer,
} from '../types/site-transfers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   POST   /site-transfers/web                                                → SiteTransferDto    (full; items array embedded)
 *   GET    /site-transfers/web                                                → SiteTransferDto[]  (full list)
 *   GET    /site-transfers/web/all?pageNo&pageSize                            → SiteTransferDto[]  (paginated; returned as plain array, no envelope)
 *   GET    /site-transfers/web/{id}                                           → SiteTransferDto    (full)
 *   GET    /site-transfers/web/status/{status}                                → SiteTransferDto[]  (full; filtered server-side by status bucket)
 *   GET    /site-transfers/web/sending-project/{projectId}                    → SiteTransferDto[]  (full; filtered server-side by sending project)
 *   GET    /site-transfers/web/receiving-project/{projectId}                  → SiteTransferDto[]  (full; filtered server-side by receiving project)
 *   PATCH  /site-transfers/web/{id}/status?status                             → ApiResponse        (ack per spec; status comes from a query-string parameter, body empty)
 *   DELETE /site-transfers/web/{id}                                           → (not implemented server-side)
 *
 * The PATCH status endpoint's spec-defined response is `ApiResponse`,
 * but {@link siteTransfersService.updateStatus} parses it through
 * {@link parseSiteTransfer} on the tolerant assumption the server may
 * upgrade to returning the full entity. The status mutation hook
 * ({@link useUpdateSiteTransferStatus}) guards against both shapes at
 * runtime.
 *
 * Backend has no DELETE endpoint —
 * {@link useDeleteSiteTransfer} fails fast rather than issuing a
 * request.
 */

/**
 * Parses a single site-transfer payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link SiteTransfer}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseSiteTransfer(data: Raw): SiteTransfer {
  try {
    return parseSiteTransfer(data);
  } catch (error) {
    logger.error('Failed to parse site transfer:', error);
    throw new ApiError('Failed to process site transfer data.', 422);
  }
}

/**
 * Parses an array of site-transfer payloads. Returns `[]` for any
 * non-array input (defensive against backend shape drift).
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link SiteTransfer} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParseSiteTransfers(data: Raw[]): SiteTransfer[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseSiteTransfer(item));
  } catch (error) {
    logger.error('Failed to parse site transfers:', error);
    throw new ApiError('Failed to process site transfers data.', 422);
  }
}

export const siteTransfersService = {
  /**
   * Creates a new site transfer together with its line items
   * (`POST /site-transfers/web`). Posting the transfer decrements
   * stock at the sending location and writes inventory-transaction
   * ledger entries server-side.
   *
   * A transfer is always created {@link SiteTransferStatus.pending}: the
   * endpoint accepts no other status and defaults to it when the payload
   * names none. The later states say the receiving site has taken delivery
   * and are reached through {@link siteTransfersService.updateStatus}.
   *
   * @param dto - The {@link CreateSiteTransferRequest} payload.
   * @returns The newly-created {@link SiteTransfer} with embedded
   *   items.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async create(dto: CreateSiteTransferRequest): Promise<SiteTransfer> {
    const data = await api.post<Raw>(
      '/site-transfers/web',
      createSiteTransferToJson(dto)
    );
    return safeParseSiteTransfer(data);
  },

  /**
   * Fetches every site transfer unpaginated
   * (`GET /site-transfers/web`).
   *
   * @returns Every {@link SiteTransfer} in the organisation.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAll(): Promise<SiteTransfer[]> {
    const data = await api.get<Raw[]>('/site-transfers/web');
    return safeParseSiteTransfers(data);
  },

  /**
   * Fetches a page of site transfers
   * (`GET /site-transfers/web/all`). The backend returns a plain
   * array (no envelope); pagination metadata is not exposed.
   *
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of transfers per page. Defaults to `10`.
   * @returns The {@link SiteTransfer}s for the requested page.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAllPaginated(pageNo = 0, pageSize = 10): Promise<SiteTransfer[]> {
    const data = await api.get<Raw[]>('/site-transfers/web/all', {
      pageNo,
      pageSize,
    });
    return safeParseSiteTransfers(data);
  },

  /**
   * Fetches a single site transfer by ID
   * (`GET /site-transfers/web/{id}`).
   *
   * @param id - Surrogate ID of the transfer.
   * @returns The {@link SiteTransfer} with embedded items.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getById(id: number): Promise<SiteTransfer> {
    const data = await api.get<Raw>(`/site-transfers/web/${id}`);
    return safeParseSiteTransfer(data);
  },

  /**
   * Fetches every site transfer currently in the given lifecycle
   * state (`GET /site-transfers/web/status/{status}`).
   *
   * @param status - The {@link SiteTransferStatus} bucket to filter
   *   by.
   * @returns The matching {@link SiteTransfer}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getByStatus(status: SiteTransferStatus): Promise<SiteTransfer[]> {
    const data = await api.get<Raw[]>(`/site-transfers/web/status/${status}`);
    return safeParseSiteTransfers(data);
  },

  /**
   * Fetches every site transfer originating from the given project
   * (`GET /site-transfers/web/sending-project/{projectId}`).
   *
   * @param projectId - Surrogate ID of the sending project.
   * @returns The matching {@link SiteTransfer}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getBySendingProject(projectId: number): Promise<SiteTransfer[]> {
    const data = await api.get<Raw[]>(
      `/site-transfers/web/sending-project/${projectId}`
    );
    return safeParseSiteTransfers(data);
  },

  /**
   * Fetches every site transfer destined for the given project
   * (`GET /site-transfers/web/receiving-project/{projectId}`).
   *
   * @param projectId - Surrogate ID of the receiving project.
   * @returns The matching {@link SiteTransfer}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getByReceivingProject(projectId: number): Promise<SiteTransfer[]> {
    const data = await api.get<Raw[]>(
      `/site-transfers/web/receiving-project/${projectId}`
    );
    return safeParseSiteTransfers(data);
  },

  /**
   * Transitions a site transfer to a new lifecycle state via the
   * dedicated status endpoint
   * (`PATCH /site-transfers/web/{id}/status?status=…`).
   *
   * The spec-defined response is `ApiResponse` (ack only), but this
   * method parses the response through {@link parseSiteTransfer} in
   * case the backend upgrades to returning the full entity. The
   * status mutation hook ({@link useUpdateSiteTransferStatus})
   * branches on `data.id` at runtime to handle either shape.
   *
   * @param id - Surrogate ID of the transfer.
   * @param status - The new {@link SiteTransferStatus} value.
   * @returns The updated {@link SiteTransfer} when the backend
   *   returns a full entity, or a parsed-from-`ApiResponse` shape
   *   that the mutation hook handles gracefully.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async updateStatus(
    id: number,
    status: SiteTransferStatus
  ): Promise<SiteTransfer> {
    const data = await api.patch<Raw>(
      `/site-transfers/web/${id}/status`,
      {},
      { status }
    );
    return safeParseSiteTransfer(data);
  },

  /**
   * Deletes a site transfer (`DELETE /site-transfers/web/{id}`).
   *
   * Not implemented server-side. Reaching this method results in a
   * 404 from the API; see {@link useDeleteSiteTransfer} for the
   * frontend-side fail-fast wrapper.
   *
   * @param id - Surrogate ID of the transfer to delete.
   * @throws {ApiError} On a non-2xx response (always, until the
   *   endpoint is implemented).
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/site-transfers/web/${id}`);
  },
};
