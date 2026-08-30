/**
 * @module finance-invoice-service
 *
 * Typed client for the AR invoice endpoints (`/finance/invoices/web`, resolved
 * against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET  /finance/invoices/web`                    → `Page<InvoiceDto>` (page)
 * - `POST /finance/invoices/web`                    → `InvoiceDto` (full)
 * - `GET  /finance/invoices/web/{id}`               → `InvoiceDto` (query)
 * - `POST /finance/invoices/web/{id}/issue`         → `InvoiceDto` (full; posts a journal entry)
 * - `POST /finance/invoices/web/{id}/cancel?reason` → `InvoiceDto` (full)
 *
 * The listing returns a Spring `Page`; {@link financeInvoiceService.list}
 * normalizes it into a {@link PagedInvoice} rather than unwrapping to a bare
 * array, because a receivables screen pages on `totalElements` and cannot
 * recover it once it is discarded. The rows come back newest invoice date
 * first, with the invoice number breaking a same-day tie, and that order is
 * fixed on the server, so paging is stable between requests and there is no
 * sort to choose here.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Invoice,
  InvoiceStatus,
  parseInvoice,
  CreateInvoiceRequest,
  createInvoiceToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/invoices/web';

/**
 * A parsed page of AR invoices, mirroring the Spring `Page<InvoiceDto>`
 * envelope.
 */
export interface PagedInvoice {
  /** The invoices on this page. */
  content: Invoice[];
  /** Total invoices matching the filters, across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** 0-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/**
 * Rows per page when the caller names none. Matches the other finance
 * listings rather than the server's own default of 10, so a receivables table
 * fills a screen.
 */
export const INVOICE_PAGE_SIZE = 20;

/** Paging + filter options for the invoice listing. They combine with AND. */
export interface InvoiceListParams {
  /** 0-based page index. Defaults to 0 on the backend. */
  pageNo?: number;
  /**
   * Rows per page. Defaults to {@link INVOICE_PAGE_SIZE}; the server caps it at
   * 500.
   */
  pageSize?: number;
  /** Restrict to invoices billed to one customer. */
  customerId?: string;
  /** Restrict to one lifecycle status. */
  status?: InvoiceStatus;
  /**
   * Restrict to what is still owed, that is `ISSUED` or `PARTIALLY_PAID`. This
   * is the one thing `status` cannot express, because an unpaid balance spans
   * two statuses. Only sent when true, since the server already defaults it to
   * false.
   */
  openOnly?: boolean;
}

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
 * Parses the rows of a listing. A row that is present but unreadable becomes a
 * 422 rather than being dropped, because silently losing an invoice from a
 * receivables list is worse than saying the list could not be read.
 */
function safeParseInvoices(items: unknown[]): Invoice[] {
  try {
    return items.map((item) => parseInvoice(item));
  } catch (error) {
    logger.error('Failed to parse invoice listing data:', error);
    throw new ApiError(
      'Failed to process invoice data. Please try again.',
      422
    );
  }
}

/**
 * Normalizes a Spring `Page<InvoiceDto>` body into a {@link PagedInvoice}.
 *
 * A bare array is accepted for the same reason the sibling construction-invoice
 * client accepts one, and carries no envelope, so the rows in hand are all
 * there is. Any other shape is logged and read as an empty page, so a partial
 * outage leaves the screen empty rather than broken.
 */
function safeParseInvoicePage(
  data: ApiResponse,
  params: InvoiceListParams
): PagedInvoice {
  if (Array.isArray(data)) {
    const content = safeParseInvoices(data);
    return {
      content,
      totalElements: content.length,
      totalPages: 1,
      number: 0,
      size: params.pageSize ?? content.length,
    };
  }
  if (!Array.isArray(data?.content)) {
    logger.warn('Invoices API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: params.pageNo ?? 0,
      size: params.pageSize ?? INVOICE_PAGE_SIZE,
    };
  }
  return {
    content: safeParseInvoices(data.content),
    totalElements: data.totalElements ?? 0,
    totalPages: data.totalPages ?? 0,
    number: data.number ?? params.pageNo ?? 0,
    size: data.size ?? params.pageSize ?? 10,
  };
}

/**
 * Finance Invoice Service — AR invoice lifecycle (draft → issue → cancel).
 */
export const financeInvoiceService = {
  /**
   * Lists accounts-receivable invoices for the current tenant.
   *
   * `GET /finance/invoices/web` → `Page<InvoiceDto>`, normalized to a
   * {@link PagedInvoice} so the caller keeps the total it pages on.
   *
   * A filter the caller leaves unset is not sent, because an absent parameter
   * leaves that dimension unfiltered on the server and the string `undefined`
   * would not.
   *
   * @param params - Optional page plus `customerId` / `status` / `openOnly`
   *   filters.
   * @returns The requested {@link PagedInvoice}.
   * @throws {ApiError} On non-2xx responses, or 422 if a row fails to parse.
   */
  async list(params: InvoiceListParams = {}): Promise<PagedInvoice> {
    const query: Record<string, string | number | boolean> = {
      pageNo: params.pageNo ?? 0,
      pageSize: params.pageSize ?? INVOICE_PAGE_SIZE,
    };
    if (params.customerId) query.customerId = params.customerId;
    if (params.status) query.status = params.status;
    if (params.openOnly) query.openOnly = true;
    const data = await api.get<ApiResponse>(BASE, query);
    return safeParseInvoicePage(data, params);
  },

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
