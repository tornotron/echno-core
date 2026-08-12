/**
 * @module finance-construction-invoice-service
 *
 * Typed client for the construction-invoice endpoints
 * (`/finance/construction-invoices/web`, resolved against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /finance/construction-invoices/web`      → `ConstructionInvoiceDto` (full)
 * - `GET  /finance/construction-invoices/web/{id}` → `ConstructionInvoiceDto` (query)
 * - `GET  /finance/construction-invoices/web`      → `Page<ConstructionInvoiceDto>` (list)
 * - `PUT  /finance/construction-invoices/web/{id}` → `ConstructionInvoiceDto` (full)
 *
 * The list endpoint returns a Spring `Page`; {@link getAll} unwraps `.content`
 * and parses each row, returning a plain `ConstructionInvoice[]`.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  ConstructionInvoice,
  parseConstructionInvoice,
  CreateConstructionInvoiceRequest,
  createConstructionInvoiceToJson,
  UpdateConstructionInvoiceRequest,
  updateConstructionInvoiceToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/construction-invoices/web';

/** Optional filters for the construction-invoice list. */
export interface ConstructionInvoiceListParams {
  /** Restrict to a single project. */
  projectId?: number;
  /** Restrict to a single vendor. */
  vendorId?: number;
  /** Restrict to a lifecycle status (SCREAMING_SNAKE_CASE). */
  status?: string;
  /** Restrict to an invoice type (SCREAMING_SNAKE_CASE). */
  type?: string;
}

/** Safely parse an invoice, converting parse failures into a 422 ApiError. */
function safeParseConstructionInvoice(data: ApiResponse): ConstructionInvoice {
  try {
    return parseConstructionInvoice(data);
  } catch (error) {
    logger.error('Failed to parse construction invoice data:', error);
    throw new ApiError(
      'Failed to process construction invoice data. Please try again.',
      422
    );
  }
}

/**
 * Unwraps a Spring `Page<ConstructionInvoiceDto>` (or a bare array) into parsed
 * rows. Logs a warning and returns `[]` for any other shape so a partial outage
 * does not break consumers.
 */
function safeParseConstructionInvoices(
  data: ApiResponse
): ConstructionInvoice[] {
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (!Array.isArray(data) && !Array.isArray(data?.content)) {
    logger.warn('Construction invoices API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    return [];
  }
  try {
    return items.map((item) => parseConstructionInvoice(item));
  } catch (error) {
    logger.error('Failed to parse construction invoices data:', error);
    throw new ApiError(
      'Failed to process construction invoices data. Please try again.',
      422
    );
  }
}

/**
 * Finance Construction Invoice Service — construction-side invoicing
 * (purchase, sales, expense, service).
 */
export const financeConstructionInvoiceService = {
  /**
   * Lists construction invoices, optionally filtered.
   *
   * `GET /finance/construction-invoices/web` → `Page<ConstructionInvoiceDto>`.
   * The Spring page envelope is unwrapped to a plain array of parsed rows.
   *
   * @param params - Optional `projectId` / `vendorId` / `status` / `type` filters.
   * @returns The parsed {@link ConstructionInvoice} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getAll(
    params: ConstructionInvoiceListParams = {}
  ): Promise<ConstructionInvoice[]> {
    const query: Record<string, string | number | boolean> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.vendorId !== undefined) query.vendorId = params.vendorId;
    if (params.status !== undefined) query.status = params.status;
    if (params.type !== undefined) query.type = params.type;
    const data = await api.get<ApiResponse>(BASE, query);
    return safeParseConstructionInvoices(data);
  },

  /**
   * Fetches a single construction invoice by id.
   *
   * `GET /finance/construction-invoices/web/{id}`
   *
   * @param id - UUID of the invoice.
   * @returns The {@link ConstructionInvoice}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<ConstructionInvoice> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseConstructionInvoice(data);
  },

  /**
   * Creates a construction invoice.
   *
   * `POST /finance/construction-invoices/web` → `ConstructionInvoiceDto` (full).
   *
   * @param req - Invoice fields ({@link CreateConstructionInvoiceRequest}).
   * @returns The created {@link ConstructionInvoice}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(
    req: CreateConstructionInvoiceRequest
  ): Promise<ConstructionInvoice> {
    const data = await api.post<ApiResponse>(
      BASE,
      createConstructionInvoiceToJson(req)
    );
    return safeParseConstructionInvoice(data);
  },

  /**
   * Updates a construction invoice (full replacement).
   *
   * `PUT /finance/construction-invoices/web/{id}` → `ConstructionInvoiceDto`
   * (full).
   *
   * @param id - UUID of the invoice.
   * @param req - Replacement fields ({@link UpdateConstructionInvoiceRequest}).
   * @returns The updated {@link ConstructionInvoice}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(
    id: string,
    req: UpdateConstructionInvoiceRequest
  ): Promise<ConstructionInvoice> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}`,
      updateConstructionInvoiceToJson(req)
    );
    return safeParseConstructionInvoice(data);
  },
};
