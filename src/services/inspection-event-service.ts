/**
 * @module inspection-event-service
 *
 * Typed client for the inspection event log, resolved against the `/api/v1`
 * base. Read-only: events are recorded server-side inside the transaction that
 * makes the change, and nothing writes them through the API.
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET /inspections/web/{id}/events` → `Page<InspectionEventDto>` (list)
 * - `GET /ncrs/web/{id}/events`        → `Page<InspectionEventDto>` (list)
 * - `GET /inspections/web/events`      → `Page<InspectionEventDto>` (list, project-wide)
 *
 * Every endpoint returns a Spring `Page`, oldest first. The page envelope is
 * kept rather than flattened because a timeline is paged in the UI and needs
 * the total to say how much history there is.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  InspectionEvent,
  InspectionEventSubjectType,
  parseInspectionEvent,
} from '../types/inspection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const INSPECTION_BASE = '/inspections/web';
const NCR_BASE = '/ncrs/web';

/** Paging for a timeline. */
export interface InspectionEventPageParams {
  /** Zero-based page number. */
  page?: number;
  /** Page size. */
  size?: number;
}

/** Filters for the project-wide event query, on top of paging. */
export interface InspectionEventQueryParams extends InspectionEventPageParams {
  /** Restrict to one project. */
  projectId?: number;
  /** Restrict to events about one kind of row. */
  subjectType?: InspectionEventSubjectType;
  /** Restrict to one event type (the dot-namespaced wire constant). */
  eventType?: string;
  /** Restrict to one actor, by the `actorId` string. */
  actorId?: string;
  /** Events at or after this instant (ISO string). */
  from?: string;
  /** Events at or before this instant (ISO string). */
  to?: string;
}

/**
 * A parsed page of events, mirroring the Spring `Page<InspectionEventDto>`
 * envelope. Entries are oldest first, as served.
 */
export interface PagedInspectionEvents {
  /** The events on this page, oldest first. */
  content: InspectionEvent[];
  /** Total events across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** Zero-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/**
 * Normalises a Spring `Page<InspectionEventDto>` body (or a bare array, for
 * resilience) into a {@link PagedInspectionEvents} so callers always receive
 * page metadata.
 */
function safeParseEventPage(
  data: ApiResponse,
  pageSize: number
): PagedInspectionEvents {
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (!Array.isArray(data) && !Array.isArray(data?.content)) {
    logger.warn('Inspection events API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: pageSize,
    };
  }
  let content: InspectionEvent[];
  try {
    content = items.map((item) => parseInspectionEvent(item));
  } catch (error) {
    logger.error('Failed to parse inspection events:', error);
    throw new ApiError(
      'Failed to process inspection history. Please try again.',
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
      typeof data.totalElements === 'number'
        ? data.totalElements
        : content.length,
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

const DEFAULT_PAGE_SIZE = 50;

/** Builds the paging query, omitting whatever the caller left unset. */
function pagingQuery(
  params: InspectionEventPageParams
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.page !== undefined) query.page = params.page;
  if (params.size !== undefined) query.size = params.size;
  return query;
}

/** Inspection Event Service — the append-only history of the inspection module. */
export const inspectionEventService = {
  /**
   * The full timeline of an inspection: its own events and those of its check
   * items, defects, NCRs and reinspections, oldest first.
   *
   * `GET /inspections/web/{id}/events` → `Page<InspectionEventDto>`.
   *
   * @param inspectionId - UUID of the inspection.
   * @param params - Zero-based `page` and `size`.
   * @returns One page of events with its metadata.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getByInspection(
    inspectionId: string,
    params: InspectionEventPageParams = {}
  ): Promise<PagedInspectionEvents> {
    const data = await api.get<ApiResponse>(
      `${INSPECTION_BASE}/${inspectionId}/events`,
      pagingQuery(params)
    );
    return safeParseEventPage(data, params.size ?? DEFAULT_PAGE_SIZE);
  },

  /**
   * The timeline of one NCR, oldest first.
   *
   * `GET /ncrs/web/{id}/events` → `Page<InspectionEventDto>`.
   *
   * @param ncrId - UUID of the report.
   * @param params - Zero-based `page` and `size`.
   * @returns One page of events with its metadata.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getByNcr(
    ncrId: string,
    params: InspectionEventPageParams = {}
  ): Promise<PagedInspectionEvents> {
    const data = await api.get<ApiResponse>(
      `${NCR_BASE}/${ncrId}/events`,
      pagingQuery(params)
    );
    return safeParseEventPage(data, params.size ?? DEFAULT_PAGE_SIZE);
  },

  /**
   * Events across a project, filtered.
   *
   * `GET /inspections/web/events` → `Page<InspectionEventDto>`. Every filter
   * is optional and they combine.
   *
   * @param params - Filters and paging ({@link InspectionEventQueryParams}).
   * @returns One page of events with its metadata.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async query(
    params: InspectionEventQueryParams = {}
  ): Promise<PagedInspectionEvents> {
    const query = pagingQuery(params);
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.subjectType !== undefined) query.subjectType = params.subjectType;
    if (params.eventType !== undefined) query.eventType = params.eventType;
    if (params.actorId !== undefined) query.actorId = params.actorId;
    if (params.from !== undefined) query.from = params.from;
    if (params.to !== undefined) query.to = params.to;
    const data = await api.get<ApiResponse>(`${INSPECTION_BASE}/events`, query);
    return safeParseEventPage(data, params.size ?? DEFAULT_PAGE_SIZE);
  },
};
