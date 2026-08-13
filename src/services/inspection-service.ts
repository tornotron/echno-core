/**
 * @module inspection-service
 *
 * Typed client for the inspection endpoints (`/inspections/web`, resolved
 * against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /inspections/web`      → `InspectionDto` (full)
 * - `GET  /inspections/web/{id}` → `InspectionDto` (query)
 * - `GET  /inspections/web`      → `Page<InspectionDto>` (list)
 * - `PUT  /inspections/web/{id}` → `InspectionDto` (full)
 *
 * The list endpoint returns a Spring `Page`; {@link getAll} unwraps `.content`
 * and parses each row, returning a plain `Inspection[]`.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Inspection,
  parseInspection,
  CreateInspectionRequest,
  createInspectionToJson,
  UpdateInspectionRequest,
  updateInspectionToJson,
} from '../types/inspection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/inspections/web';

/** Optional filters for the inspection list. */
export interface InspectionListParams {
  /** Restrict to a single project. */
  projectId?: number;
  /** Restrict to a lifecycle status (hyphenated wire value, e.g. `in-progress`). */
  status?: string;
  /** Restrict to an inspection type (wire value, e.g. `quality`). */
  type?: string;
  /** Restrict to a result (hyphenated wire value, e.g. `passed-with-remarks`). */
  result?: string;
}

/** Safely parse an inspection, converting parse failures into a 422 ApiError. */
function safeParseInspection(data: ApiResponse): Inspection {
  try {
    return parseInspection(data);
  } catch (error) {
    logger.error('Failed to parse inspection data:', error);
    throw new ApiError(
      'Failed to process inspection data. Please try again.',
      422
    );
  }
}

/**
 * Unwraps a Spring `Page<InspectionDto>` (or a bare array) into parsed rows.
 * Logs a warning and returns `[]` for any other shape so a partial outage does
 * not break consumers.
 */
function safeParseInspections(data: ApiResponse): Inspection[] {
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (!Array.isArray(data) && !Array.isArray(data?.content)) {
    logger.warn('Inspections API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    return [];
  }
  try {
    return items.map((item) => parseInspection(item));
  } catch (error) {
    logger.error('Failed to parse inspections data:', error);
    throw new ApiError(
      'Failed to process inspections data. Please try again.',
      422
    );
  }
}

/** Inspection Service — site inspections with their check points and defects. */
export const inspectionService = {
  /**
   * Lists inspections, optionally filtered.
   *
   * `GET /inspections/web` → `Page<InspectionDto>`. The Spring page envelope is
   * unwrapped to a plain array of parsed rows.
   *
   * @param params - Optional `projectId` / `status` / `type` / `result` filters.
   * @returns The parsed {@link Inspection} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getAll(params: InspectionListParams = {}): Promise<Inspection[]> {
    const query: Record<string, string | number | boolean> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.status !== undefined) query.status = params.status;
    if (params.type !== undefined) query.type = params.type;
    if (params.result !== undefined) query.result = params.result;
    const data = await api.get<ApiResponse>(BASE, query);
    return safeParseInspections(data);
  },

  /**
   * Fetches a single inspection by id.
   *
   * `GET /inspections/web/{id}`
   *
   * @param id - UUID of the inspection.
   * @returns The {@link Inspection}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<Inspection> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseInspection(data);
  },

  /**
   * Creates an inspection.
   *
   * `POST /inspections/web` → `InspectionDto` (full).
   *
   * @param req - Inspection fields ({@link CreateInspectionRequest}).
   * @returns The created {@link Inspection}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(req: CreateInspectionRequest): Promise<Inspection> {
    const data = await api.post<ApiResponse>(BASE, createInspectionToJson(req));
    return safeParseInspection(data);
  },

  /**
   * Updates an inspection (full replacement).
   *
   * `PUT /inspections/web/{id}` → `InspectionDto` (full).
   *
   * @param id - UUID of the inspection.
   * @param req - Replacement fields ({@link UpdateInspectionRequest}).
   * @returns The updated {@link Inspection}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(
    id: string,
    req: UpdateInspectionRequest
  ): Promise<Inspection> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}`,
      updateInspectionToJson(req)
    );
    return safeParseInspection(data);
  },
};
