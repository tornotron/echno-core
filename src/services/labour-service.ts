/**
 * @module labour-service
 *
 * Typed client for the labour backend endpoints under `/labour/web`. Wraps
 * `api.*` calls and parses raw JSON into strongly-typed {@link Labour}
 * domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { parseLabour } from '../types/labour';
import type {
  Labour,
  LabourCreateRequest,
  LabourUpdateRequest,
} from '../types/labour';

type ApiResponse = Record<string, unknown>;

/**
 * Backend response shape audit:
 *
 *   GET    /labour/web          → LabourDto[]     (full list)
 *   GET    /labour/web/{id}     → LabourDto        (full)
 *   POST   /labour/web          → LabourSimpleDto  (partial — adds org/project context, labourId casing differs from LabourDto)
 *   PATCH  /labour/web/{id}     → ApiResponse      (ack only)
 *   DELETE /labour/web/{id}     → ApiResponse      (ack only)
 *
 * `Labour` is a flat domain type with no nested arrays. `LabourSimpleDto`
 * carries the same scalar surface as `LabourDto` but uses `labourId` (lower
 * `d`) where `LabourDto` uses `labourID`, and `emergencyContactPhone` where
 * `LabourDto` uses `emergencyContactNumber`. {@link parseLabour} normalises
 * both pairs. The create mutation hook seeds the detail cache with the
 * SimpleDto response and invalidates it immediately so the next observer
 * refetches the canonical `LabourDto`.
 */

/**
 * Parses a single labour payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link Labour}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseLabour(data: ApiResponse): Labour {
  try {
    return parseLabour(data);
  } catch (error) {
    logger.error('Failed to parse labour data:', error);
    throw new ApiError('Failed to process labour data. Please try again.', 422);
  }
}

/**
 * Parses an array of labour payloads.
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link Labour} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParseLabours(data: ApiResponse[]): Labour[] {
  try {
    return data.map((item) => parseLabour(item));
  } catch (error) {
    logger.error('Failed to parse labour list:', error);
    throw new ApiError('Failed to process labour data. Please try again.', 422);
  }
}

/**
 * Thin wrapper around the backend labour REST endpoints.
 */
export const labourService = {
  /**
   * Fetches every labour record.
   *
   * `GET /labour/web` → `LabourDto[]` (full).
   *
   * @returns A resolved array of {@link Labour} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAll(): Promise<Labour[]> {
    const data = await api.get<ApiResponse[]>('/labour/web');
    return safeParseLabours(data);
  },

  /**
   * Fetches a single labour record by ID.
   *
   * `GET /labour/web/{id}` → `LabourDto` (full).
   *
   * @param id - Surrogate ID of the labour record.
   * @returns The resolved {@link Labour}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getById(id: number): Promise<Labour> {
    const data = await api.get<ApiResponse>(`/labour/web/${id}`);
    return safeParseLabour(data);
  },

  /**
   * Creates a new labour record.
   *
   * `POST /labour/web` → `LabourSimpleDto` (partial — uses `labourId` /
   * `emergencyContactPhone` field-name variants and may add denormalised
   * org/project context fields not present on `LabourDto`).
   *
   * @param request - The create request payload.
   * @returns The newly created {@link Labour}, parsed from the SimpleDto
   *   response. Mutation hooks invalidate the detail key after a successful
   *   create so the next observer pulls the canonical `LabourDto`.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async create(request: LabourCreateRequest): Promise<Labour> {
    const data = await api.post<ApiResponse>('/labour/web', request);
    return safeParseLabour(data);
  },

  /**
   * Updates a labour record by ID.
   *
   * `PATCH /labour/web/{id}` → `ApiResponse` (ack only — no body to parse).
   *
   * @param id - Surrogate ID of the labour record to update.
   * @param request - Fields to update; only set fields are sent.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async update(id: number, request: LabourUpdateRequest): Promise<void> {
    await api.patch(`/labour/web/${id}`, request);
  },

  /**
   * Deletes a labour record by ID.
   *
   * `DELETE /labour/web/{id}` → `ApiResponse` (ack only — no body to parse).
   *
   * @param id - Surrogate ID of the labour record to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/labour/web/${id}`);
  },
};
