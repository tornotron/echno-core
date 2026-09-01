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
  ReceiveSiteTransferRequest,
  receiveSiteTransferToJson,
  CancelSiteTransferRequest,
  cancelSiteTransferToJson,
} from '../types/site-transfers';
import {
  StatusTransition,
  parseStatusTransition,
} from '../types/history';

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
 *   PATCH  /site-transfers/web/{id}/status?status                             → 400 always        (refuses every status since echno-backend#660)
 *   POST   /site-transfers/web/{id}/receive                                   → SiteTransferDto    (full; the receiving site's statement of what arrived)
 *   POST   /site-transfers/web/{id}/cancel                                    → SiteTransferDto    (full; reverses the outbound leg)
 *   GET    /site-transfers/web/{id}/status-history?pageNo&pageSize            → Page<StatusTransitionDto>
 *   DELETE /site-transfers/web/{id}                                           → (not implemented server-side)
 *
 * The PATCH status endpoint now refuses everything it is handed and names
 * its replacements. {@link siteTransfersService.updateStatus} is kept so an
 * existing caller gets an answer rather than a compile error, but it is
 * deprecated and there is no payload that makes it succeed.
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

/**
 * A parsed page of status-trail entries, mirroring the Spring
 * `Page<StatusTransitionDto>` envelope.
 */
export interface PagedStatusTransition {
  /** The entries on this page, newest first. */
  content: StatusTransition[];
  /** Total entries across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** 0-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/**
 * Normalises a Spring `Page<StatusTransitionDto>` body (or a bare array, for
 * resilience) into a {@link PagedStatusTransition}.
 *
 * @param data - The raw response body.
 * @param pageSize - The size that was asked for, used when the body carries none.
 * @returns The parsed page.
 * @throws {ApiError} When any entry fails parsing (HTTP 422).
 */
function safeParseStatusHistory(
  data: Raw,
  pageSize: number
): PagedStatusTransition {
  const parseAll = (rows: Raw[]): StatusTransition[] => {
    if (!Array.isArray(rows)) return [];
    try {
      return rows.map((row) => parseStatusTransition(row));
    } catch (error) {
      logger.error('Failed to parse site transfer status history:', error);
      throw new ApiError('Failed to process site transfer history.', 422);
    }
  };

  if (Array.isArray(data)) {
    const content = parseAll(data);
    return {
      content,
      totalElements: content.length,
      totalPages: 1,
      number: 0,
      size: pageSize,
    };
  }
  return {
    content: parseAll(data?.content ?? []),
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    number: data?.number ?? 0,
    size: data?.size ?? pageSize,
  };
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
   * Always refused. It used to assign whatever status it was handed and
   * move no stock, which is how a transfer could read `COMPLETED` with
   * nothing confirmed at the far end. The route is kept server-side so an
   * existing client gets an answer naming its replacement rather than a 404.
   *
   * @param id - Surrogate ID of the transfer.
   * @param status - The new {@link SiteTransferStatus} value.
   * @returns Never resolves in practice.
   * @throws {ApiError} Always, with a 400 naming the endpoint that does what
   *   the caller wanted.
   *
   * @deprecated Since echno-backend#660 every state a transfer can hold
   *   follows from a movement, so this endpoint refuses whatever it is given.
   *   Record a delivery with {@link siteTransfersService.receive}, or abandon
   *   one that never arrived with {@link siteTransfersService.cancel}.
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
   * Records what the receiving site took delivery of
   * (`POST /site-transfers/web/{id}/receive`).
   *
   * Posts the stock that actually arrived at the receiving project and
   * location, writes each named line's received quantity, and lets the server
   * derive the status from the arithmetic: every line met is
   * {@link SiteTransferStatus.completed}, some received is
   * {@link SiteTransferStatus.partiallyTransferred}, nothing received leaves
   * it {@link SiteTransferStatus.pending}.
   *
   * Only a transfer that crosses a project boundary can be received. One
   * between two stores on a single project had both of its legs written at
   * creation and is refused here.
   *
   * Receiving less than was sent is accepted with no acknowledgement and
   * leaves an open variance on the transfer. Receiving more is refused with a
   * 400 naming the line and the figures, unless the payload sets
   * {@link ReceiveSiteTransferRequest.allowOverReceipt}.
   *
   * @param id - Surrogate ID of the transfer.
   * @param dto - What arrived.
   * @returns The transfer as it now stands, with received and in-transit
   *   quantities on every line.
   * @throws {ApiError} On a non-2xx response or parse failure. A 400 whose
   *   message names `allowOverReceipt` is the over-receipt refusal and is a
   *   decision for the caller rather than a fault.
   */
  async receive(
    id: number,
    dto: ReceiveSiteTransferRequest
  ): Promise<SiteTransfer> {
    const data = await api.post<Raw>(
      `/site-transfers/web/${id}/receive`,
      receiveSiteTransferToJson(dto)
    );
    return safeParseSiteTransfer(data);
  },

  /**
   * Abandons a transfer that never arrived
   * (`POST /site-transfers/web/{id}/cancel`).
   *
   * Returns the whole sent quantity to the sending project and location it
   * was drawn from, as a real movement on the ledger. Only a
   * {@link SiteTransferStatus.pending} transfer can be cancelled.
   *
   * @param id - Surrogate ID of the transfer.
   * @param dto - Why it is being abandoned. The reason is required.
   * @returns The cancelled {@link SiteTransfer}.
   * @throws {ApiError} On a non-2xx response or parse failure. A 400 says the
   *   transfer is in some state other than `PENDING`, or that no reason was
   *   given.
   */
  async cancel(
    id: number,
    dto: CancelSiteTransferRequest
  ): Promise<SiteTransfer> {
    const data = await api.post<Raw>(
      `/site-transfers/web/${id}/cancel`,
      cancelSiteTransferToJson(dto)
    );
    return safeParseSiteTransfer(data);
  },

  /**
   * Reads a transfer's status trail
   * (`GET /site-transfers/web/{id}/status-history`), newest first.
   *
   * Unlike a purchase order's receipt-driven move, a transfer reaching
   * `PARTIALLY_TRANSFERRED` or `COMPLETED` is somebody's act, so those entries
   * name the person who confirmed the delivery. A transfer raised before the
   * trail existed carries a `BASELINE` entry naming the status it was observed
   * to hold, and one raised before the two-step document existed may carry a
   * `SYSTEM` entry recording that its status was corrected to match movements
   * already posted. Those two are not somebody's act and
   * {@link isPersonsChange} is how a screen tells them apart.
   *
   * Requires the `system-admin` role in the current tenant; a caller without
   * it gets a 403, which is a trail they may not read rather than a trail that
   * is empty.
   *
   * @param id - Surrogate ID of the transfer.
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Entries per page. Defaults to `20`.
   * @returns The page of {@link StatusTransition} entries and its metadata.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getStatusHistory(
    id: number,
    pageNo = 0,
    pageSize = 20
  ): Promise<PagedStatusTransition> {
    const data = await api.get<Raw>(
      `/site-transfers/web/${id}/status-history`,
      { pageNo, pageSize }
    );
    return safeParseStatusHistory(data, pageSize);
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
