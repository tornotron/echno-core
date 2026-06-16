/**
 * @module shift-timing-service
 *
 * Typed client for the shift-timing backend endpoints under
 * `/shift-timings/web`. Wraps `api.*` calls and parses raw JSON into
 * strongly-typed {@link ShiftTiming} domain objects.
 *
 * Kept in its own module — separate from attendance-settings —
 * because shift timings are referenced by attendance, scheduling,
 * payroll, and any future roster-based feature; none of those should
 * pull in the broader attendance-settings surface.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses
 * or when the response payload fails parsing.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  createShiftTimingToJson,
  parseShiftTiming,
  updateShiftTimingToJson,
  type ShiftTiming,
  type CreateShiftTimingRequest,
  type UpdateShiftTimingRequest,
} from '../types/shift-timing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   GET    /shift-timings/web         → ShiftTimingDto[]  (flat list)
 *   GET    /shift-timings/web/{id}    → ShiftTimingDto    (full)
 *   POST   /shift-timings/web         → ShiftTimingDto    (full)
 *   PATCH  /shift-timings/web/{id}    → ShiftTimingDto    (full)
 *   DELETE /shift-timings/web/{id}    → void              (no body)
 */

/**
 * Parses a single shift-timing payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link ShiftTiming}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeShift(raw: Raw): ShiftTiming {
  try {
    return parseShiftTiming(raw);
  } catch (error) {
    logger.error('Failed to parse shift timing:', error);
    throw new ApiError('Failed to process shift timing data.', 422);
  }
}

/**
 * Parses an array of shift-timing payloads. Returns `[]` for any
 * non-array input (defensive against backend shape drift).
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link ShiftTiming} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeShifts(data: Raw[]): ShiftTiming[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseShiftTiming(item));
  } catch (error) {
    logger.error('Failed to parse shift timing list:', error);
    throw new ApiError('Failed to process shift timing data.', 422);
  }
}

export const shiftTimingService = {
  /**
   * Fetches every configured shift timing
   * (`GET /shift-timings/web`).
   *
   * @returns Every {@link ShiftTiming} configured on the tenant, in
   *   the order the backend returns.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAll(): Promise<ShiftTiming[]> {
    const data = await api.get<Raw[]>('/shift-timings/web');
    return safeShifts(data);
  },

  /**
   * Fetches a single shift timing by ID
   * (`GET /shift-timings/web/{id}`).
   *
   * @param id - Surrogate ID of the shift timing.
   * @returns The matching {@link ShiftTiming}.
   * @throws {ApiError} On a non-2xx response (including 404) or
   *   parse failure.
   */
  async getById(id: number): Promise<ShiftTiming> {
    const data = await api.get<Raw>(`/shift-timings/web/${id}`);
    return safeShift(data);
  },

  /**
   * Creates a new shift timing
   * (`POST /shift-timings/web` → `ShiftTimingDto` full).
   *
   * @param dto - The create payload.
   * @returns The newly-created {@link ShiftTiming}, including the
   *   server-assigned `id`.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async create(dto: CreateShiftTimingRequest): Promise<ShiftTiming> {
    const data = await api.post<Raw>(
      '/shift-timings/web',
      createShiftTimingToJson(dto)
    );
    return safeShift(data);
  },

  /**
   * Patches an existing shift timing
   * (`PATCH /shift-timings/web/{id}` → `ShiftTimingDto` full). Only
   * the fields set on `dto` are sent.
   *
   * @param id - Surrogate ID of the shift timing.
   * @param dto - Partial update payload; omitted fields are left
   *   untouched server-side.
   * @returns The updated {@link ShiftTiming} with all fields
   *   populated.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async update(
    id: number,
    dto: UpdateShiftTimingRequest
  ): Promise<ShiftTiming> {
    const data = await api.patch<Raw>(
      `/shift-timings/web/${id}`,
      updateShiftTimingToJson(dto)
    );
    return safeShift(data);
  },

  /**
   * Deletes a shift timing
   * (`DELETE /shift-timings/web/{id}` → no body).
   *
   * @param id - Surrogate ID of the shift timing to delete.
   * @returns Resolves once the backend acknowledges the deletion.
   * @throws {ApiError} On a non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/shift-timings/web/${id}`);
  },
};
