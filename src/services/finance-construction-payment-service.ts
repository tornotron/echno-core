/**
 * @module finance-construction-payment-service
 *
 * Typed client for the construction-payment endpoints
 * (`/finance/construction-payments/web`, resolved against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /finance/construction-payments/web`      → `ConstructionPaymentDto` (full)
 * - `GET  /finance/construction-payments/web/{id}` → `ConstructionPaymentDto` (query)
 * - `GET  /finance/construction-payments/web`      → `Page<ConstructionPaymentDto>` (list)
 * - `PUT  /finance/construction-payments/web/{id}` → `ConstructionPaymentDto` (full)
 * - `POST /finance/construction-payments/web/{id}/verify` → `ConstructionPaymentDto` (full)
 * - `POST /finance/construction-payments/web/{id}/cancel` → `ConstructionPaymentDto` (full)
 *
 * The list endpoint returns a Spring `Page`; {@link getAll} unwraps `.content`
 * and parses each row, returning a plain `ConstructionPayment[]`.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  ConstructionPayment,
  parseConstructionPayment,
  CreateConstructionPaymentRequest,
  createConstructionPaymentToJson,
  UpdateConstructionPaymentRequest,
  updateConstructionPaymentToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/construction-payments/web';

/** Optional filters for the construction-payment list. */
export interface ConstructionPaymentListParams {
  /** Restrict to a single project. */
  projectId?: number;
  /** Restrict to a single vendor. */
  vendorId?: number;
  /** Restrict to a voucher status (SCREAMING_SNAKE_CASE). */
  status?: string;
  /** Restrict to a payment type (SCREAMING_SNAKE_CASE). */
  type?: string;
  /** Restrict to a payee type (SCREAMING_SNAKE_CASE). */
  payeeType?: string;
}

/** Safely parse a payment, converting parse failures into a 422 ApiError. */
function safeParseConstructionPayment(data: ApiResponse): ConstructionPayment {
  try {
    return parseConstructionPayment(data);
  } catch (error) {
    logger.error('Failed to parse construction payment data:', error);
    throw new ApiError(
      'Failed to process construction payment data. Please try again.',
      422
    );
  }
}

/**
 * Unwraps a Spring `Page<ConstructionPaymentDto>` (or a bare array) into parsed
 * rows. Logs a warning and returns `[]` for any other shape so a partial outage
 * does not break consumers.
 */
function safeParseConstructionPayments(
  data: ApiResponse
): ConstructionPayment[] {
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (!Array.isArray(data) && !Array.isArray(data?.content)) {
    logger.warn('Construction payments API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    return [];
  }
  try {
    return items.map((item) => parseConstructionPayment(item));
  } catch (error) {
    logger.error('Failed to parse construction payments data:', error);
    throw new ApiError(
      'Failed to process construction payments data. Please try again.',
      422
    );
  }
}

/**
 * Finance Construction Payment Service — outgoing construction payment
 * vouchers.
 */
export const financeConstructionPaymentService = {
  /**
   * Lists construction payment vouchers, optionally filtered.
   *
   * `GET /finance/construction-payments/web` → `Page<ConstructionPaymentDto>`.
   * The Spring page envelope is unwrapped to a plain array of parsed rows.
   *
   * @param params - Optional `projectId` / `vendorId` / `status` / `type` /
   *   `payeeType` filters.
   * @returns The parsed {@link ConstructionPayment} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getAll(
    params: ConstructionPaymentListParams = {}
  ): Promise<ConstructionPayment[]> {
    const query: Record<string, string | number | boolean> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.vendorId !== undefined) query.vendorId = params.vendorId;
    if (params.status !== undefined) query.status = params.status;
    if (params.type !== undefined) query.type = params.type;
    if (params.payeeType !== undefined) query.payeeType = params.payeeType;
    const data = await api.get<ApiResponse>(BASE, query);
    return safeParseConstructionPayments(data);
  },

  /**
   * Fetches a single construction payment voucher by id.
   *
   * `GET /finance/construction-payments/web/{id}`
   *
   * @param id - UUID of the payment.
   * @returns The {@link ConstructionPayment}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<ConstructionPayment> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseConstructionPayment(data);
  },

  /**
   * Creates a construction payment voucher (starts `PENDING`).
   *
   * `POST /finance/construction-payments/web` → `ConstructionPaymentDto` (full).
   *
   * @param req - Payment fields ({@link CreateConstructionPaymentRequest}).
   * @returns The created {@link ConstructionPayment}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(
    req: CreateConstructionPaymentRequest
  ): Promise<ConstructionPayment> {
    const data = await api.post<ApiResponse>(
      BASE,
      createConstructionPaymentToJson(req)
    );
    return safeParseConstructionPayment(data);
  },

  /**
   * Updates a construction payment voucher (full replacement).
   *
   * `PUT /finance/construction-payments/web/{id}` → `ConstructionPaymentDto`
   * (full).
   *
   * Refused with a 400 on two states the caller can see in advance, so a screen
   * is better off not offering the edit than letting the user fill a form in
   * and lose it:
   *
   * - **the voucher is verified.** echno-backend#636 freezes it, because an
   *   edit would leave the stamp attesting to figures nobody checked. The
   *   correction route is {@link cancel} and raise a replacement.
   * - **`status` is `CANCELLED`.** Cancelling is {@link cancel}, which records
   *   the required reason; setting the status through a full replacement would
   *   be a cancellation that also silently changes an amount.
   *
   * @param id - UUID of the payment.
   * @param req - Replacement fields ({@link UpdateConstructionPaymentRequest}).
   * @returns The updated {@link ConstructionPayment}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(
    id: string,
    req: UpdateConstructionPaymentRequest
  ): Promise<ConstructionPayment> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}`,
      updateConstructionPaymentToJson(req)
    );
    return safeParseConstructionPayment(data);
  },

  /**
   * Records the current user as the voucher's verifier.
   *
   * `POST /finance/construction-payments/web/{id}/verify` →
   * `ConstructionPaymentDto` (full).
   *
   * **Nothing about the verifier is sent, and there is no body.** The backend
   * stamps `verifiedBy` from the session and `verifiedAt` from the clock. That
   * is the whole point of the endpoint: echno-backend#631 replaced the pair of
   * payload fields it supersedes because a caller who could edit a voucher
   * could record that a named colleague had checked a payment, at a time of
   * their choosing.
   *
   * The action is refused, with the reason in the `ApiError` message, when the
   * voucher is cancelled, when it is already verified, and when the caller is
   * the account that raised it. That last one is segregation of duties rather
   * than a validation slip, so it is worth surfacing the server's wording
   * instead of a generic failure.
   *
   * @param id - UUID of the payment.
   * @returns The verified {@link ConstructionPayment}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async verify(id: string): Promise<ConstructionPayment> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/verify`, null);
    return safeParseConstructionPayment(data);
  },

  /**
   * Voids a construction payment voucher, recording why.
   *
   * `POST /finance/construction-payments/web/{id}/cancel` →
   * `ConstructionPaymentDto` (full).
   *
   * This is the only route to `CANCELLED`. Before echno-backend#636 the status
   * was set through {@link update}, which now refuses it; that same change
   * froze a verified voucher against editing, so cancelling is also the only
   * way to correct one. Cancel, then raise the replacement.
   *
   * The reason is **required and non-blank**, max 1000 characters, and a blank
   * one comes back 400. A voided voucher that does not say what was wrong with
   * it explains nothing, and on a verified voucher it is the only record of why
   * somebody's check was set aside.
   *
   * Cancelling is one-way: a second cancellation is refused. The verification
   * stamp is deliberately left in place, so a cancelled voucher still names its
   * verifier and reads as "checked, then voided" rather than as a
   * contradiction. There is no unverify.
   *
   * @param id - UUID of the payment.
   * @param reason - Why the voucher is being voided. Required, non-blank, max
   *   1000 characters.
   * @returns The cancelled {@link ConstructionPayment}, carrying its
   *   {@link ConstructionPayment.cancellationReason}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async cancel(id: string, reason: string): Promise<ConstructionPayment> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/cancel`, {
      reason,
    });
    return safeParseConstructionPayment(data);
  },
};
