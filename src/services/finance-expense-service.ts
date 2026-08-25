/**
 * @module finance-expense-service
 *
 * Typed client for the expense endpoints (`/expenses/web`, resolved against the
 * `/api/v1` base).
 *
 * Endpoint audit (response DTO label -> classification):
 * - `GET    /expenses/web`             -> `ExpenseDto[]`        (list)
 * - `GET    /expenses/web/paginated`   -> `Page<ExpenseDto>`    (page)
 * - `GET    /expenses/web/{id}`        -> `ExpenseDto`          (full)
 * - `POST   /expenses/web`             -> `ExpenseDto`          (full)
 * - `PUT    /expenses/web/{id}`        -> `ExpenseDto`          (full)
 * - `DELETE /expenses/web/{id}`        -> `ApiResponse`         (ack only)
 *
 * The unpaginated list backs dropdowns, totals and lookups; {@link getPage}
 * unwraps the Spring `Page` envelope into a {@link PagedExpense} so the table
 * keeps its pagination metadata.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Expense,
  parseExpense,
  CreateExpenseRequest,
  createExpenseToJson,
  UpdateExpenseRequest,
  updateExpenseToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/expenses/web';

/**
 * A parsed page of expenses, mirroring the Spring `Page<ExpenseDto>` envelope.
 */
export interface PagedExpense {
  /** The expenses on this page. */
  content: Expense[];
  /** Total expenses across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** 0-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/** Paging + filter options for the paginated expense list. */
export interface ExpensePageParams {
  /** 0-based page index. Defaults to 0 on the backend. */
  page?: number;
  /** Page size. Defaults to 10 on the backend. */
  size?: number;
  /** Free-text match over the expense number and description. */
  search?: string;
  /** An `ExpenseStatus` value (e.g. `'pending'`). */
  status?: string;
}

/** Safely parse an expense, converting parse failures into a 422 ApiError. */
function safeParseExpense(data: ApiResponse): Expense {
  try {
    return parseExpense(data);
  } catch (error) {
    logger.error('Failed to parse expense data:', error);
    throw new ApiError('Failed to process expense data. Please try again.', 422);
  }
}

/**
 * Parses an array of expense payloads. Throws if the backend returns a
 * non-array, since downstream consumers assume an iterable shape.
 */
function safeParseExpenses(data: ApiResponse): Expense[] {
  if (!Array.isArray(data)) {
    logger.error('Invalid expenses payload: expected array, received:', {
      type: typeof data,
      keys: data && typeof data === 'object' ? Object.keys(data) : null,
    });
    throw new ApiError('Invalid expenses payload: expected array.', 422);
  }
  try {
    return data.map((item) => parseExpense(item));
  } catch (error) {
    logger.error('Failed to parse expenses data:', error);
    throw new ApiError(
      'Failed to process expenses data. Please try again.',
      422
    );
  }
}

/**
 * Normalizes a Spring `Page<ExpenseDto>` body (or a bare array, for resilience)
 * into a {@link PagedExpense} so callers always receive page metadata.
 */
function safeParseExpensePage(
  data: ApiResponse,
  params: ExpensePageParams
): PagedExpense {
  if (Array.isArray(data)) {
    const content = safeParseExpenses(data);
    return {
      content,
      totalElements: content.length,
      totalPages: 1,
      number: 0,
      size: params.size ?? content.length,
    };
  }
  return {
    content: safeParseExpenses(data?.content ?? []),
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    number: data?.number ?? 0,
    size: data?.size ?? params.size ?? 10,
  };
}

/**
 * Finance Expense Service — money spent against a project or the organization,
 * with optional links to a project, vendor, employee, invoice, payment or
 * budget head.
 */
export const financeExpenseService = {
  /**
   * Lists every expense for the current tenant, unpaginated.
   *
   * `GET /expenses/web` -> `ExpenseDto[]`.
   *
   * @returns The parsed {@link Expense} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getAll(): Promise<Expense[]> {
    const data = await api.get<ApiResponse>(BASE);
    return safeParseExpenses(data);
  },

  /**
   * Fetches one page of expenses.
   *
   * `GET /expenses/web/paginated` -> `Page<ExpenseDto>`. The Spring page
   * envelope is normalized to {@link PagedExpense}. Use {@link getAll} where the
   * full set is required (counts, lookups).
   *
   * @param params - 0-based `page`, `size`, plus optional `search` / `status`.
   * @returns A {@link PagedExpense} page of expenses.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getPage(params: ExpensePageParams = {}): Promise<PagedExpense> {
    const query: Record<string, string | number> = {};
    if (params.page !== undefined) query.pageNo = params.page;
    if (params.size !== undefined) query.pageSize = params.size;
    if (params.search) query.search = params.search;
    if (params.status) query.status = params.status;
    const data = await api.get<ApiResponse>(`${BASE}/paginated`, query);
    return safeParseExpensePage(data, params);
  },

  /**
   * Fetches a single expense by id.
   *
   * `GET /expenses/web/{id}` -> `ExpenseDto`.
   *
   * @param id - Numeric id of the expense.
   * @returns The {@link Expense}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: number): Promise<Expense> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseExpense(data);
  },

  /**
   * Creates an expense. The expense number is generated by the server.
   *
   * `POST /expenses/web` -> `ExpenseDto` (full).
   *
   * @param req - Expense fields ({@link CreateExpenseRequest}).
   * @returns The created {@link Expense}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(req: CreateExpenseRequest): Promise<Expense> {
    const data = await api.post<ApiResponse>(BASE, createExpenseToJson(req));
    return safeParseExpense(data);
  },

  /**
   * Updates an expense (full replacement of its editable details).
   *
   * `PUT /expenses/web/{id}` -> `ExpenseDto` (full).
   *
   * @param id - Numeric id of the expense.
   * @param req - Replacement fields ({@link UpdateExpenseRequest}).
   * @returns The updated {@link Expense}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(id: number, req: UpdateExpenseRequest): Promise<Expense> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}`,
      updateExpenseToJson(req)
    );
    return safeParseExpense(data);
  },

  /**
   * Deletes an expense by id.
   *
   * `DELETE /expenses/web/{id}` -> `ApiResponse` (ack only — no body to parse).
   *
   * @param id - Numeric id of the expense to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx responses.
   */
  async remove(id: number): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },
};
