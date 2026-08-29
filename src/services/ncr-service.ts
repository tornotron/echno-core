/**
 * @module ncr-service
 *
 * Typed client for the non-conformance-report endpoints (`/ncrs/web`, resolved
 * against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /ncrs/web`                                 → `NcrDto` (full)
 * - `GET  /ncrs/web/{id}`                            → `NcrDto` (query)
 * - `GET  /ncrs/web`                                 → `Page<NcrDto>` (list)
 * - `POST /ncrs/web/{id}/assign`                     → `NcrDto` (full)
 * - `POST /ncrs/web/{id}/corrective-action-complete` → `NcrDto` (full)
 * - `POST /ncrs/web/{id}/verify`                     → `NcrDto` (full)
 * - `POST /ncrs/web/{id}/reject`                     → `NcrDto` (full)
 * - `POST /ncrs/web/{id}/reopen`                     → `NcrDto` (full)
 * - `POST /ncrs/web/{id}/close`                      → `NcrDto` (full)
 *
 * There is one method per lifecycle transition rather than an update that takes
 * a status, because that is how the backend is built: it refuses any move its
 * transition table does not allow, so a settable status field would only let a
 * caller construct a request that is certain to fail. `availableNcrActions`
 * says which are legal from a given state.
 *
 * The list endpoint returns a Spring `Page`; {@link getAll} unwraps `.content`
 * and parses each row, returning a plain `Ncr[]`.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  AssignNcrRequest,
  assignNcrToJson,
  CreateNcrRequest,
  createNcrToJson,
  Ncr,
  NcrRemarksRequest,
  ncrRemarksToJson,
  parseNcr,
} from '../types/inspection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/ncrs/web';

/** Optional filters for the NCR list. */
export interface NcrListParams {
  /** Restrict to the reports raised against one inspection (UUID). */
  inspectionId?: string;
  /** Restrict to a discipline (wire value, `quality` or `safety`). */
  type?: string;
  /** Restrict to a lifecycle state (hyphenated wire value, e.g. `reopened`). */
  status?: string;
  /** Restrict to the reports one engineer is accountable for. */
  siteEngineerId?: number;
  /**
   * `true` returns the punch list: every report that is not yet closed, whatever
   * stage it has reached. Distinct from filtering on `status`, which would need
   * six separate calls to express the same thing.
   */
  open?: boolean;
  /** Zero-based page number. */
  page?: number;
  /** Page size. */
  size?: number;
}

/** Safely parse an NCR, converting parse failures into a 422 ApiError. */
function safeParseNcr(data: ApiResponse): Ncr {
  try {
    return parseNcr(data);
  } catch (error) {
    logger.error('Failed to parse NCR data:', error);
    throw new ApiError('Failed to process NCR data. Please try again.', 422);
  }
}

/**
 * Unwraps a Spring `Page<NcrDto>` (or a bare array) into parsed rows. Logs a
 * warning and returns `[]` for any other shape so a partial outage does not
 * break consumers, matching the inspection list.
 */
function safeParseNcrs(data: ApiResponse): Ncr[] {
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (!Array.isArray(data) && !Array.isArray(data?.content)) {
    logger.warn('NCRs API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    return [];
  }
  try {
    return items.map((item) => parseNcr(item));
  } catch (error) {
    logger.error('Failed to parse NCRs data:', error);
    throw new ApiError('Failed to process NCRs data. Please try again.', 422);
  }
}

/** Builds the query object, omitting every filter the caller left unset. */
function toQuery(
  params: NcrListParams
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.inspectionId !== undefined) query.inspectionId = params.inspectionId;
  if (params.type !== undefined) query.type = params.type;
  if (params.status !== undefined) query.status = params.status;
  if (params.siteEngineerId !== undefined)
    query.siteEngineerId = params.siteEngineerId;
  if (params.open !== undefined) query.open = params.open;
  if (params.page !== undefined) query.page = params.page;
  if (params.size !== undefined) query.size = params.size;
  return query;
}

/** NCR Service — non-conformance reports and their sign-off workflow. */
export const ncrService = {
  /**
   * Lists non-conformance reports, optionally filtered.
   *
   * `GET /ncrs/web` → `Page<NcrDto>`. The Spring page envelope is unwrapped to a
   * plain array of parsed rows.
   *
   * @param params - Optional filters; `open: true` returns the punch list.
   * @returns The parsed {@link Ncr} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getAll(params: NcrListParams = {}): Promise<Ncr[]> {
    const data = await api.get<ApiResponse>(BASE, toQuery(params));
    return safeParseNcrs(data);
  },

  /**
   * Fetches a single report by id.
   *
   * `GET /ncrs/web/{id}`
   *
   * @param id - UUID of the report.
   * @returns The {@link Ncr}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<Ncr> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseNcr(data);
  },

  /**
   * Raises a report against an inspection.
   *
   * `POST /ncrs/web` → `NcrDto` (full). The number, the type and the raiser are
   * set server-side; naming a site engineer here moves the report straight to
   * assigned.
   *
   * @param req - Report fields ({@link CreateNcrRequest}).
   * @returns The created {@link Ncr}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(req: CreateNcrRequest): Promise<Ncr> {
    const data = await api.post<ApiResponse>(BASE, createNcrToJson(req));
    return safeParseNcr(data);
  },

  /**
   * Hands the corrective work to a site engineer, or moves it to a different
   * one.
   *
   * `POST /ncrs/web/{id}/assign` → `NcrDto` (full). Allowed from open, rejected
   * and reopened.
   *
   * @param id - UUID of the report.
   * @param req - The engineer and the due date ({@link AssignNcrRequest}).
   * @returns The updated {@link Ncr}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async assign(id: string, req: AssignNcrRequest): Promise<Ncr> {
    const data = await api.post<ApiResponse>(
      `${BASE}/${id}/assign`,
      assignNcrToJson(req)
    );
    return safeParseNcr(data);
  },

  /**
   * Records that the corrective work has been carried out, which puts the report
   * up for re-inspection.
   *
   * `POST /ncrs/web/{id}/corrective-action-complete` → `NcrDto` (full).
   *
   * @param id - UUID of the report.
   * @param req - What was done. Optional; every note on the lifecycle is.
   * @returns The updated {@link Ncr}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async completeCorrectiveAction(
    id: string,
    req?: NcrRemarksRequest
  ): Promise<Ncr> {
    const data = await api.post<ApiResponse>(
      `${BASE}/${id}/corrective-action-complete`,
      ncrRemarksToJson(req)
    );
    return safeParseNcr(data);
  },

  /**
   * Accepts the corrective work after re-inspection.
   *
   * `POST /ncrs/web/{id}/verify` → `NcrDto` (full). Verification is not closure:
   * closing is a separate, role-gated act.
   *
   * @param id - UUID of the report.
   * @param req - The verifier's note. Optional.
   * @returns The updated {@link Ncr}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async verify(id: string, req?: NcrRemarksRequest): Promise<Ncr> {
    const data = await api.post<ApiResponse>(
      `${BASE}/${id}/verify`,
      ncrRemarksToJson(req)
    );
    return safeParseNcr(data);
  },

  /**
   * Sends work that was declared complete back to the assignee.
   *
   * `POST /ncrs/web/{id}/reject` → `NcrDto` (full). The report returns to the
   * engineer who owns it, not to whoever raised it.
   *
   * @param id - UUID of the report.
   * @param req - Why the work was not accepted. Optional.
   * @returns The updated {@link Ncr}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async reject(id: string, req?: NcrRemarksRequest): Promise<Ncr> {
    const data = await api.post<ApiResponse>(
      `${BASE}/${id}/reject`,
      ncrRemarksToJson(req)
    );
    return safeParseNcr(data);
  },

  /**
   * Reopens a verified or closed report because the same non-conformance has
   * been found again.
   *
   * `POST /ncrs/web/{id}/reopen` → `NcrDto` (full). Deliberately not a second
   * report: the history of the first one is the evidence that it recurred.
   *
   * @param id - UUID of the report.
   * @param req - Why it was reopened. Optional.
   * @returns The updated {@link Ncr}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async reopen(id: string, req?: NcrRemarksRequest): Promise<Ncr> {
    const data = await api.post<ApiResponse>(
      `${BASE}/${id}/reopen`,
      ncrRemarksToJson(req)
    );
    return safeParseNcr(data);
  },

  /**
   * Closes a verified report.
   *
   * `POST /ncrs/web/{id}/close` → `NcrDto` (full). Takes no body. Who may call
   * it depends on the report's type: a quality report is closed by a QA
   * engineer, a safety one by a safety officer.
   *
   * @param id - UUID of the report.
   * @returns The updated {@link Ncr}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async close(id: string): Promise<Ncr> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/close`, {});
    return safeParseNcr(data);
  },
};
