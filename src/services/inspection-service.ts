/**
 * @module inspection-service
 *
 * Typed client for the inspection endpoints (`/inspections/web`, resolved
 * against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /inspections/web`                  → `InspectionDto` (full)
 * - `GET  /inspections/web/{id}`             → `InspectionDto` (query)
 * - `GET  /inspections/web`                  → `Page<InspectionDto>` (list)
 * - `PUT  /inspections/web/{id}`             → `InspectionDto` (full)
 * - `GET  /inspections/web/{id}/annotations` → `Page<DefectPhotoAnnotationDto>` (list)
 * - `PUT  /inspections/web/{id}/annotations` → `DefectPhotoAnnotationDto[]` (full)
 *
 * The list endpoints return a Spring `Page`; {@link getAll} and
 * {@link getAnnotations} unwrap `.content` and parse each row, returning a plain
 * array. The annotation replace is a `PUT` that answers with a bare array rather
 * than a page, because it returns exactly what was just stored.
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
  DefectPhotoAnnotation,
  parseDefectPhotoAnnotation,
  ReplaceAnnotationsRequest,
  replaceAnnotationsToJson,
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
  /**
   * Restrict to a category (hyphenated wire value, e.g. `qa-qc`). This is the
   * axis the QA/QC views filter on; `type` stays the finer label.
   */
  category?: string;
  /**
   * Restrict to a trade (hyphenated wire value, e.g. `shuttering-formwork`).
   * Only QA/QC and other-category inspections carry one.
   */
  trade?: string;
  /** Restrict to a result (hyphenated wire value, e.g. `passed-with-remarks`). */
  result?: string;
}

/** Optional paging for the annotation list. */
export interface AnnotationListParams {
  /** Zero-based page number. */
  page?: number;
  /** Page size. */
  size?: number;
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

/**
 * Unwraps the annotation payload into parsed rows. The list endpoint answers
 * with a Spring `Page` and the replace endpoint with a bare array, so both
 * shapes are accepted here rather than in two near-identical helpers.
 *
 * Unlike the inspection list, an unexpected shape throws rather than degrading
 * to `[]`: silently reporting no marks on a marked-up photograph would be read
 * as evidence that none were drawn.
 */
function safeParseAnnotations(data: ApiResponse): DefectPhotoAnnotation[] {
  const items: unknown[] | null = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : null;
  if (items === null) {
    logger.error('Annotations API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    throw new ApiError(
      'Failed to process photo annotation data. Please try again.',
      422
    );
  }
  try {
    return items.map((item) => parseDefectPhotoAnnotation(item));
  } catch (error) {
    logger.error('Failed to parse photo annotation data:', error);
    throw new ApiError(
      'Failed to process photo annotation data. Please try again.',
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
   * @param params - Optional `projectId` / `status` / `type` / `category` /
   *   `trade` / `result` filters.
   * @returns The parsed {@link Inspection} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getAll(params: InspectionListParams = {}): Promise<Inspection[]> {
    const query: Record<string, string | number | boolean> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.status !== undefined) query.status = params.status;
    if (params.type !== undefined) query.type = params.type;
    if (params.category !== undefined) query.category = params.category;
    if (params.trade !== undefined) query.trade = params.trade;
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

  /**
   * Lists the marks drawn over an inspection's defect photographs.
   *
   * `GET /inspections/web/{id}/annotations` → `Page<DefectPhotoAnnotationDto>`.
   * The Spring page envelope is unwrapped to a plain array of parsed rows.
   *
   * Each mark names the photograph it is drawn on, exactly as that photograph
   * appears in a defect's `photos` list, and positions itself as fractions of
   * the image. Group them with `annotationsByPhoto`; nothing here is keyed by a
   * defect id, because an inspection's defects are rebuilt on every save.
   *
   * @param id - UUID of the inspection.
   * @param params - Optional paging. The endpoint is paged, so a canvas that
   *   needs every mark should ask for a size above the inspection's count.
   * @returns The parsed {@link DefectPhotoAnnotation} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getAnnotations(
    id: string,
    params: AnnotationListParams = {}
  ): Promise<DefectPhotoAnnotation[]> {
    const query: Record<string, string | number | boolean> = {};
    if (params.page !== undefined) query.page = params.page;
    if (params.size !== undefined) query.size = params.size;
    const data = await api.get<ApiResponse>(`${BASE}/${id}/annotations`, query);
    return safeParseAnnotations(data);
  },

  /**
   * Replaces every mark on an inspection with the set supplied.
   *
   * `PUT /inspections/web/{id}/annotations` → `DefectPhotoAnnotationDto[]`.
   *
   * A whole-set replace, not a merge: the client that draws these holds the
   * entire canvas, so one save records everything currently drawn and an empty
   * list clears them. Every mark must name a photograph that one of the
   * inspection's defects actually carries, or the call is refused with a 400.
   *
   * @param id - UUID of the inspection.
   * @param req - The complete set of marks ({@link ReplaceAnnotationsRequest}).
   * @returns The stored {@link DefectPhotoAnnotation} rows, in print order.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async replaceAnnotations(
    id: string,
    req: ReplaceAnnotationsRequest
  ): Promise<DefectPhotoAnnotation[]> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}/annotations`,
      replaceAnnotationsToJson(req)
    );
    return safeParseAnnotations(data);
  },

  /**
   * Re-runs AI compliance generation for a project, returning the compliance
   * inspections it created.
   *
   * `POST /inspections/web/compliance/regenerate?projectId={projectId}` →
   * `InspectionDto[]`. `projectId` is sent as a query param (the backend binds
   * it with `@RequestParam Long`). Generation is idempotent, so a re-run only
   * adds compliances that do not already exist.
   *
   * @param projectId - Numeric id of the project to generate compliances for.
   * @returns The generated compliance {@link Inspection} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async regenerateCompliance(projectId: number): Promise<Inspection[]> {
    const data = await api.post<ApiResponse>(
      `${BASE}/compliance/regenerate`,
      {},
      { projectId }
    );
    return safeParseInspections(data);
  },
};
