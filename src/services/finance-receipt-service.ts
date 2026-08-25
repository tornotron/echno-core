/**
 * @module finance-receipt-service
 *
 * Typed client for the receipt endpoints (`/receipts/web`, resolved against the
 * `/api/v1` base).
 *
 * Endpoint audit (response DTO label -> classification):
 * - `GET    /receipts/web`             -> `ReceiptDto[]`        (list)
 * - `GET    /receipts/web/paginated`   -> `Page<ReceiptDto>`    (page)
 * - `GET    /receipts/web/{id}`        -> `ReceiptDto`          (full)
 * - `POST   /receipts/web`             -> `ReceiptDto`          (full)
 * - `PUT    /receipts/web/{id}`        -> `ReceiptDto`          (full)
 * - `DELETE /receipts/web/{id}`        -> `ApiResponse`         (ack only)
 *
 * The unpaginated list backs dropdowns, totals and lookups; {@link getPage}
 * unwraps the Spring `Page` envelope into a {@link PagedReceipt} so the table
 * keeps its pagination metadata.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Receipt,
  parseReceipt,
  CreateReceiptRequest,
  createReceiptToJson,
  UpdateReceiptRequest,
  updateReceiptToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/receipts/web';

/**
 * A parsed page of receipts, mirroring the Spring `Page<ReceiptDto>` envelope.
 */
export interface PagedReceipt {
  /** The receipts on this page. */
  content: Receipt[];
  /** Total receipts across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** 0-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/** Paging + filter options for the paginated receipt list. */
export interface ReceiptPageParams {
  /** 0-based page index. Defaults to 0 on the backend. */
  page?: number;
  /** Page size. Defaults to 10 on the backend. */
  size?: number;
  /** Free-text match over the receipt number and payer. */
  search?: string;
  /** A `ReceiptStatus` value (e.g. `'issued'`). */
  status?: string;
}

/** Safely parse a receipt, converting parse failures into a 422 ApiError. */
function safeParseReceipt(data: ApiResponse): Receipt {
  try {
    return parseReceipt(data);
  } catch (error) {
    logger.error('Failed to parse receipt data:', error);
    throw new ApiError('Failed to process receipt data. Please try again.', 422);
  }
}

/**
 * Parses an array of receipt payloads. Throws if the backend returns a
 * non-array, since downstream consumers assume an iterable shape.
 */
function safeParseReceipts(data: ApiResponse): Receipt[] {
  if (!Array.isArray(data)) {
    logger.error('Invalid receipts payload: expected array, received:', {
      type: typeof data,
      keys: data && typeof data === 'object' ? Object.keys(data) : null,
    });
    throw new ApiError('Invalid receipts payload: expected array.', 422);
  }
  try {
    return data.map((item) => parseReceipt(item));
  } catch (error) {
    logger.error('Failed to parse receipts data:', error);
    throw new ApiError(
      'Failed to process receipts data. Please try again.',
      422
    );
  }
}

/**
 * Normalizes a Spring `Page<ReceiptDto>` body (or a bare array, for resilience)
 * into a {@link PagedReceipt} so callers always receive page metadata.
 */
function safeParseReceiptPage(
  data: ApiResponse,
  params: ReceiptPageParams
): PagedReceipt {
  if (Array.isArray(data)) {
    const content = safeParseReceipts(data);
    return {
      content,
      totalElements: content.length,
      totalPages: 1,
      number: 0,
      size: params.size ?? content.length,
    };
  }
  return {
    content: safeParseReceipts(data?.content ?? []),
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    number: data?.number ?? 0,
    size: data?.size ?? params.size ?? 10,
  };
}

/**
 * Finance Receipt Service — money received against a project or the
 * organization, with optional links to a project, payment, invoice or customer.
 */
export const financeReceiptService = {
  /**
   * Lists every receipt for the current tenant, unpaginated.
   *
   * `GET /receipts/web` -> `ReceiptDto[]`.
   *
   * @returns The parsed {@link Receipt} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getAll(): Promise<Receipt[]> {
    const data = await api.get<ApiResponse>(BASE);
    return safeParseReceipts(data);
  },

  /**
   * Fetches one page of receipts.
   *
   * `GET /receipts/web/paginated` -> `Page<ReceiptDto>`. The Spring page
   * envelope is normalized to {@link PagedReceipt}. Use {@link getAll} where the
   * full set is required (counts, lookups).
   *
   * @param params - 0-based `page`, `size`, plus optional `search` / `status`.
   * @returns A {@link PagedReceipt} page of receipts.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getPage(params: ReceiptPageParams = {}): Promise<PagedReceipt> {
    const query: Record<string, string | number> = {};
    if (params.page !== undefined) query.pageNo = params.page;
    if (params.size !== undefined) query.pageSize = params.size;
    if (params.search) query.search = params.search;
    if (params.status) query.status = params.status;
    const data = await api.get<ApiResponse>(`${BASE}/paginated`, query);
    return safeParseReceiptPage(data, params);
  },

  /**
   * Fetches a single receipt by id.
   *
   * `GET /receipts/web/{id}` -> `ReceiptDto`.
   *
   * @param id - Numeric id of the receipt.
   * @returns The {@link Receipt}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: number): Promise<Receipt> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseReceipt(data);
  },

  /**
   * Creates a receipt. The receipt number is generated by the server.
   *
   * `POST /receipts/web` -> `ReceiptDto` (full).
   *
   * @param req - Receipt fields ({@link CreateReceiptRequest}).
   * @returns The created {@link Receipt}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(req: CreateReceiptRequest): Promise<Receipt> {
    const data = await api.post<ApiResponse>(BASE, createReceiptToJson(req));
    return safeParseReceipt(data);
  },

  /**
   * Updates a receipt (full replacement of its editable details).
   *
   * `PUT /receipts/web/{id}` -> `ReceiptDto` (full).
   *
   * @param id - Numeric id of the receipt.
   * @param req - Replacement fields ({@link UpdateReceiptRequest}).
   * @returns The updated {@link Receipt}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(id: number, req: UpdateReceiptRequest): Promise<Receipt> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}`,
      updateReceiptToJson(req)
    );
    return safeParseReceipt(data);
  },

  /**
   * Deletes a receipt by id.
   *
   * `DELETE /receipts/web/{id}` -> `ApiResponse` (ack only — no body to parse).
   *
   * @param id - Numeric id of the receipt to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx responses.
   */
  async remove(id: number): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },
};
