/**
 * @module observation-service
 *
 * Typed client for the observation endpoints, resolved against the `/api/v1`
 * base.
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET  /inspections/web/observations`                    → `Page<ObservationDto>` (list)
 * - `GET  /inspections/web/observations/{id}`               → `ObservationDto` (query)
 * - `POST /inspections/web/observations`                    → `ObservationDto` (full)
 * - `POST /inspections/web/observations/{id}/review`        → `ObservationDto` (full)
 * - `GET  /inspections/web/observations/{id}/evidence`      → `AttachmentDto[]` (list)
 * - `POST /inspections/web/observations/{id}/evidence/presign`  → `PresignedUpload[]`
 * - `POST /inspections/web/observations/{id}/evidence/register` → `AttachmentDto[]` (201)
 *
 * The list is a Spring page, newest first as served, and the envelope is
 * kept because the pending queue is paged in the UI. The backend answers
 * 409 to a second decision on the same observation, 400 to a rejection
 * with no note and to a modification with no change; the serializer refuses
 * the last two before the round trip.
 *
 * `POST /observations/intake` is the machine producers' door (service
 * accounts only) and is not wrapped: nothing in the console posts there.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Attachment,
  parseAttachment,
  parsePresignedUpload,
  PresignedUpload,
  RegisterUploadRequest,
  UploadRequest,
} from '../types/attachment';
import {
  CreateObservationRequest,
  createObservationToJson,
  Observation,
  ObservationReviewStatus,
  ObservationSource,
  parseObservation,
  ReviewObservationRequest,
  reviewObservationToJson,
} from '../types/inspection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/inspections/web/observations';

/** Filters and paging for the observation list. */
export interface ObservationListParams {
  /** Project to list for. */
  projectId?: number;
  /** Review state to filter on; omit for every state. */
  reviewStatus?: ObservationReviewStatus;
  /** Source to filter on; omit for every source. */
  source?: ObservationSource;
  /** Only observations filed under this inspection. */
  inspectionId?: string;
  /** Only observations at or below this site structure node. */
  spatialNodeId?: string;
  /** Observed on or after (ISO string). */
  from?: string;
  /** Observed on or before (ISO string). */
  to?: string;
  /** Zero-based page number. */
  page?: number;
  /** Page size. */
  size?: number;
}

/** A parsed page of observations, mirroring the Spring `Page<ObservationDto>`. */
export interface PagedObservations {
  /** The observations on this page. */
  content: Observation[];
  /** Total observations across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** Zero-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/** Safely parse an observation, converting parse failures into a 422 ApiError. */
function safeParseObservation(data: ApiResponse): Observation {
  try {
    return parseObservation(data);
  } catch (error) {
    logger.error('Failed to parse observation data:', error);
    throw new ApiError(
      'Failed to process observation data. Please try again.',
      422
    );
  }
}

/**
 * Normalises a Spring `Page<ObservationDto>` body (or a bare array, for
 * resilience) into a {@link PagedObservations}. An unexpected shape logs
 * and comes back empty so the queue renders rather than breaks.
 */
function safeParseObservationPage(
  data: ApiResponse,
  pageSize: number
): PagedObservations {
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (!Array.isArray(data) && !Array.isArray(data?.content)) {
    logger.warn('Observations API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size: pageSize };
  }
  let content: Observation[];
  try {
    content = items.map((item) => parseObservation(item));
  } catch (error) {
    logger.error('Failed to parse observations data:', error);
    throw new ApiError(
      'Failed to process observations data. Please try again.',
      422
    );
  }
  if (Array.isArray(data)) {
    return {
      content,
      totalElements: content.length,
      totalPages: content.length > 0 ? 1 : 0,
      number: 0,
      size: pageSize,
    };
  }
  return {
    content,
    totalElements:
      typeof data.totalElements === 'number' ? data.totalElements : content.length,
    totalPages:
      typeof data.totalPages === 'number'
        ? data.totalPages
        : content.length > 0
          ? 1
          : 0,
    number: typeof data.number === 'number' ? data.number : 0,
    size: typeof data.size === 'number' ? data.size : pageSize,
  };
}

function safeParseAttachments(data: ApiResponse): Attachment[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseAttachment(item));
  } catch (error) {
    logger.error('Failed to parse observation evidence:', error);
    throw new ApiError(
      'Failed to process observation evidence. Please try again.',
      422
    );
  }
}

/** Observation Service — findings from any source and their review. */
export const observationService = {
  /**
   * One page of observations, filtered. The pending queue for a project is
   * `{ projectId, reviewStatus: 'pending' }`.
   *
   * `GET /inspections/web/observations` → `Page<ObservationDto>`.
   *
   * @param params - Filters and paging.
   * @returns The parsed page.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async list(params: ObservationListParams = {}): Promise<PagedObservations> {
    const query: Record<string, string | number> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.reviewStatus !== undefined) query.reviewStatus = params.reviewStatus;
    if (params.source !== undefined) query.source = params.source;
    if (params.inspectionId !== undefined) query.inspectionId = params.inspectionId;
    if (params.spatialNodeId !== undefined) query.spatialNodeId = params.spatialNodeId;
    if (params.from !== undefined) query.from = params.from;
    if (params.to !== undefined) query.to = params.to;
    if (params.page !== undefined) query.page = params.page;
    if (params.size !== undefined) query.size = params.size;
    const data = await api.get<ApiResponse>(BASE, query);
    return safeParseObservationPage(data, params.size ?? 20);
  },

  /**
   * Fetches a single observation by id.
   *
   * `GET /inspections/web/observations/{id}`
   *
   * @param id - UUID of the observation.
   * @returns The {@link Observation}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<Observation> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseObservation(data);
  },

  /**
   * Records a human observation. Created `ACCEPTED` with the caller as
   * reporter and reviewer.
   *
   * `POST /inspections/web/observations` → `ObservationDto` (full).
   *
   * @param req - The finding.
   * @returns The created {@link Observation}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(req: CreateObservationRequest): Promise<Observation> {
    const data = await api.post<ApiResponse>(BASE, createObservationToJson(req));
    return safeParseObservation(data);
  },

  /**
   * Decides on a pending observation.
   *
   * `POST /inspections/web/observations/{id}/review` → `ObservationDto`
   * (full). Needs `inspections.observations.review`. The backend answers 409
   * when the observation has already been decided.
   *
   * @param id - UUID of the observation.
   * @param req - The decision, note, edits and outcome.
   * @returns The reviewed {@link Observation}, with its outcome linked.
   * @throws {TypeError} On a rejection without a note or a modification
   *   without a change, before any request is sent.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async review(id: string, req: ReviewObservationRequest): Promise<Observation> {
    const data = await api.post<ApiResponse>(
      `${BASE}/${id}/review`,
      reviewObservationToJson(req)
    );
    return safeParseObservation(data);
  },

  /**
   * The attachments an observation cites as evidence.
   *
   * `GET /inspections/web/observations/{id}/evidence` → `AttachmentDto[]`.
   *
   * @param id - UUID of the observation.
   * @returns The parsed attachments; `[]` for a non-array body.
   */
  async getEvidence(id: string): Promise<Attachment[]> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}/evidence`);
    return safeParseAttachments(data);
  },

  /**
   * Step 1 of the direct-to-storage evidence flow: one presigned slot per
   * file, in request order.
   *
   * `POST /inspections/web/observations/{id}/evidence/presign`.
   *
   * @param id - UUID of the observation.
   * @param requests - One entry per file.
   * @returns The slots, in the same order.
   */
  async presignEvidence(
    id: string,
    requests: UploadRequest[]
  ): Promise<PresignedUpload[]> {
    const data = await api.post<ApiResponse>(
      `${BASE}/${id}/evidence/presign`,
      requests
    );
    if (!Array.isArray(data)) return [];
    return data.map((item) => parsePresignedUpload(item));
  },

  /**
   * Step 3 of the direct-to-storage evidence flow: confirm the uploaded keys
   * and cite them on the observation.
   *
   * `POST /inspections/web/observations/{id}/evidence/register` →
   * `AttachmentDto[]` (201).
   *
   * @param id - UUID of the observation.
   * @param requests - The keys whose PUT succeeded.
   * @returns The registered attachments.
   */
  async registerEvidence(
    id: string,
    requests: RegisterUploadRequest[]
  ): Promise<Attachment[]> {
    const data = await api.post<ApiResponse>(
      `${BASE}/${id}/evidence/register`,
      requests
    );
    return safeParseAttachments(data);
  },
};
