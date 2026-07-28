/**
 * @module finance-payment-service
 *
 * Typed client for the customer-payment (receipt) endpoints
 * (`/finance/payments/web`, resolved against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /finance/payments/web`      → `PaymentDto` (full; accepts an `Idempotency-Key` header)
 * - `GET  /finance/payments/web/{id}` → `PaymentDto` (query)
 *
 * NOTE: the spec exposes no payment **list** endpoint (only `getById` + record).
 * A list endpoint is a pending backend request.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Payment,
  parsePayment,
  RecordPaymentRequest,
  recordPaymentToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/payments/web';

/** Safely parse a payment, converting parse failures into a 422 ApiError. */
function safeParsePayment(data: ApiResponse): Payment {
  try {
    return parsePayment(data);
  } catch (error) {
    logger.error('Failed to parse payment data:', error);
    throw new ApiError('Failed to process payment data. Please try again.', 422);
  }
}

/**
 * Finance Payment Service — recording and reading incoming customer receipts.
 */
export const financePaymentService = {
  /**
   * Fetches a single payment by id.
   *
   * `GET /finance/payments/web/{id}`
   *
   * @param id - UUID of the payment.
   * @returns The {@link Payment}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<Payment> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParsePayment(data);
  },

  /**
   * Records a customer payment, allocating it across invoices.
   *
   * `POST /finance/payments/web` → `PaymentDto` (full).
   *
   * When `idempotencyKey` is provided it is sent as the `Idempotency-Key`
   * header so retries of the same logical payment are de-duplicated by the
   * backend (guards against double-recording on network retries).
   *
   * @param dto - Payment fields ({@link RecordPaymentRequest}); its
   *   `allocations` should sum to `amount`.
   * @param idempotencyKey - Optional dedupe key for safe retries.
   * @returns The recorded {@link Payment}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async record(
    dto: RecordPaymentRequest,
    idempotencyKey?: string
  ): Promise<Payment> {
    const data = await api.post<ApiResponse>(
      BASE,
      recordPaymentToJson(dto),
      undefined,
      idempotencyKey
        ? { headers: { 'Idempotency-Key': idempotencyKey } }
        : undefined
    );
    return safeParsePayment(data);
  },
};
