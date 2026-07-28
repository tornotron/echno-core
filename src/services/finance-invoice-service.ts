/**
 * @module finance-invoice-service
 *
 * Typed client for the AR invoice endpoints (`/finance/invoices/web`, resolved
 * against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /finance/invoices/web`                    → `InvoiceDto` (full)
 * - `GET  /finance/invoices/web/{id}`               → `InvoiceDto` (query)
 * - `POST /finance/invoices/web/{id}/issue`         → `InvoiceDto` (full; posts a journal entry)
 * - `POST /finance/invoices/web/{id}/cancel?reason` → `InvoiceDto` (full)
 *
 * NOTE: the spec exposes no invoice **list** endpoint (only `getById` + create /
 * issue / cancel). A list endpoint is a pending backend request; until it lands,
 * consumers surface invoices contextually.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Invoice,
  parseInvoice,
  CreateInvoiceRequest,
  createInvoiceToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/invoices/web';

/** Safely parse an invoice, converting parse failures into a 422 ApiError. */
function safeParseInvoice(data: ApiResponse): Invoice {
  try {
    return parseInvoice(data);
  } catch (error) {
    logger.error('Failed to parse invoice data:', error);
    throw new ApiError('Failed to process invoice data. Please try again.', 422);
  }
}

/**
 * Finance Invoice Service — AR invoice lifecycle (draft → issue → cancel).
 */
export const financeInvoiceService = {
  /**
   * Fetches a single invoice by id.
   *
   * `GET /finance/invoices/web/{id}`
   *
   * @param id - UUID of the invoice.
   * @returns The {@link Invoice}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<Invoice> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseInvoice(data);
  },

  /**
   * Creates a draft invoice.
   *
   * `POST /finance/invoices/web` → `InvoiceDto` (full; status `DRAFT`).
   *
   * @param dto - Invoice fields ({@link CreateInvoiceRequest}).
   * @returns The created draft {@link Invoice}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async createDraft(dto: CreateInvoiceRequest): Promise<Invoice> {
    const data = await api.post<ApiResponse>(BASE, createInvoiceToJson(dto));
    return safeParseInvoice(data);
  },

  /**
   * Issues a draft invoice (posts its journal entry).
   *
   * `POST /finance/invoices/web/{id}/issue` → `InvoiceDto` (full; status
   * `ISSUED`).
   *
   * @param id - UUID of the invoice.
   * @returns The issued {@link Invoice}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async issue(id: string): Promise<Invoice> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/issue`, {});
    return safeParseInvoice(data);
  },

  /**
   * Cancels an invoice.
   *
   * `POST /finance/invoices/web/{id}/cancel?reason={reason}` → `InvoiceDto`
   * (full; status `CANCELLED`). `reason` is required and sent as a query param.
   *
   * @param id - UUID of the invoice.
   * @param reason - Cancellation reason (required by the backend).
   * @returns The cancelled {@link Invoice}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async cancel(id: string, reason: string): Promise<Invoice> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/cancel`, {}, {
      reason,
    });
    return safeParseInvoice(data);
  },
};
