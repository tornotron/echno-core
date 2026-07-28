/**
 * @module finance-customer-service
 *
 * Typed client for the AR customer endpoints (`/finance/customers/web`,
 * resolved against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET  /finance/customers/web?id={id}`         → `CustomerDto`   (query; single)
 * - `GET  /finance/customers/web/all`             → `CustomerDto[]` (query; paged)
 * - `POST /finance/customers/web`                 → `CustomerDto`   (full)
 * - `PUT  /finance/customers/web/{id}`            → `CustomerDto`   (full)
 * - `POST /finance/customers/web/{id}/deactivate` → `200 OK`, no body (ack)
 *
 * NOTE: single-fetch takes the id as a **query param** (`?id=`), not a path
 * segment. The paged list flattens Spring's `Pageable` into `page`/`size`/`sort`
 * query params.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Customer,
  parseCustomer,
  CreateCustomerRequest,
  createCustomerToJson,
  UpdateCustomerRequest,
  updateCustomerToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/customers/web';

/** Safely parse a customer, converting parse failures into a 422 ApiError. */
function safeParseCustomer(data: ApiResponse): Customer {
  try {
    return parseCustomer(data);
  } catch (error) {
    logger.error('Failed to parse customer data:', error);
    throw new ApiError(
      'Failed to process customer data. Please try again.',
      422
    );
  }
}

/** Safely parse a customer array. */
function safeParseCustomers(data: ApiResponse[]): Customer[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseCustomer(item));
  } catch (error) {
    logger.error('Failed to parse customers data:', error);
    throw new ApiError(
      'Failed to process customers data. Please try again.',
      422
    );
  }
}

/** Options for {@link financeCustomerService.list}. */
export interface CustomerListParams {
  /** Optional name filter. */
  name?: string;
  /** 0-based page index. */
  page?: number;
  /** Page size. */
  size?: number;
  /** Sort expressions (e.g. `['name,asc']`). */
  sort?: string[];
}

/**
 * Finance Customer Service — AR customer CRUD and search.
 */
export const financeCustomerService = {
  /**
   * Fetches a single customer by id.
   *
   * `GET /finance/customers/web?id={id}`
   *
   * @param id - UUID of the customer (sent as a query param).
   * @returns The {@link Customer}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<Customer> {
    const data = await api.get<ApiResponse>(BASE, { id });
    return safeParseCustomer(data);
  },

  /**
   * Lists / searches customers (paged).
   *
   * `GET /finance/customers/web/all[?name][&page][&size][&sort]`
   *
   * @param params - Optional name filter and pagination
   *   ({@link CustomerListParams}).
   * @returns The matching {@link Customer} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async list(params: CustomerListParams = {}): Promise<Customer[]> {
    const query: Record<string, string | number> = {};
    if (params.name !== undefined) query.name = params.name;
    if (params.page !== undefined) query.page = params.page;
    if (params.size !== undefined) query.size = params.size;
    if (params.sort?.length) query.sort = params.sort.join(',');
    const data = await api.get<ApiResponse[]>(
      `${BASE}/all`,
      Object.keys(query).length > 0 ? query : undefined
    );
    return safeParseCustomers(data);
  },

  /**
   * Creates a customer.
   *
   * `POST /finance/customers/web` → `CustomerDto` (full).
   *
   * @param dto - Customer fields ({@link CreateCustomerRequest}).
   * @returns The created {@link Customer}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(dto: CreateCustomerRequest): Promise<Customer> {
    const data = await api.post<ApiResponse>(BASE, createCustomerToJson(dto));
    return safeParseCustomer(data);
  },

  /**
   * Updates a customer.
   *
   * `PUT /finance/customers/web/{id}` → `CustomerDto` (full).
   *
   * @param id - UUID of the customer.
   * @param dto - Patch fields ({@link UpdateCustomerRequest}); `code` is
   *   immutable and not part of the payload.
   * @returns The updated {@link Customer}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(id: string, dto: UpdateCustomerRequest): Promise<Customer> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}`,
      updateCustomerToJson(dto)
    );
    return safeParseCustomer(data);
  },

  /**
   * Deactivates a customer.
   *
   * `POST /finance/customers/web/{id}/deactivate` → `200 OK` with no body (ack).
   * The response is discarded; callers refetch the affected caches.
   *
   * @param id - UUID of the customer.
   * @returns Resolves once the customer is deactivated.
   * @throws {ApiError} On non-2xx responses.
   */
  async deactivate(id: string): Promise<void> {
    await api.post(`${BASE}/${id}/deactivate`, {});
  },
};
