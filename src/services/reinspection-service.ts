/**
 * @module reinspection-service
 *
 * Typed client for the reinspection endpoints, resolved against the `/api/v1`
 * base. The attempts hang off an NCR or a defect, so the paths are split
 * between the two controllers that own those rows.
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /ncrs/web/{ncrId}/reinspections`                → `ReinspectionDto` (full)
 * - `GET  /ncrs/web/{ncrId}/reinspections`                → `ReinspectionDto[]` (list)
 * - `POST /inspections/web/defects/{defectId}/reinspections` → `ReinspectionDto` (full)
 * - `GET  /inspections/web/reinspections/{id}`            → `ReinspectionDto` (query)
 * - `POST /inspections/web/reinspections/{id}/outcome`    → `ReinspectionDto` (full)
 *
 * Scheduling clones the original inspection into a new one and returns the
 * attempt that links them; the new inspection's id is on the row as
 * `reinspectionInspectionId`. The backend answers 400 when the NCR is not in
 * `corrective-action-complete` (or the defect not `resolved`), and 400 again on
 * a second outcome for the same attempt.
 *
 * The per-NCR list is a bare array, not a Spring page: attempts on one report
 * number in the low single digits.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  parseReinspection,
  Reinspection,
  ReinspectionOutcomeRequest,
  reinspectionOutcomeToJson,
  ScheduleReinspectionRequest,
  scheduleReinspectionToJson,
} from '../types/inspection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const NCR_BASE = '/ncrs/web';
const INSPECTION_BASE = '/inspections/web';

/** Safely parse a reinspection, converting parse failures into a 422 ApiError. */
function safeParseReinspection(data: ApiResponse): Reinspection {
  try {
    return parseReinspection(data);
  } catch (error) {
    logger.error('Failed to parse reinspection data:', error);
    throw new ApiError(
      'Failed to process reinspection data. Please try again.',
      422
    );
  }
}

/**
 * Parses a bare array of attempts (or a Spring page, for resilience). Logs a
 * warning and returns `[]` for any other shape so a partial outage does not
 * break the NCR detail that embeds the list.
 */
function safeParseReinspections(data: ApiResponse): Reinspection[] {
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (!Array.isArray(data) && !Array.isArray(data?.content)) {
    logger.warn('Reinspections API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    return [];
  }
  try {
    return items.map((item) => parseReinspection(item));
  } catch (error) {
    logger.error('Failed to parse reinspections data:', error);
    throw new ApiError(
      'Failed to process reinspections data. Please try again.',
      422
    );
  }
}

/** Reinspection Service — re-checks of NCRs and defects and their outcomes. */
export const reinspectionService = {
  /**
   * Lists every attempt on an NCR, in sequence order as served.
   *
   * `GET /ncrs/web/{ncrId}/reinspections` → `ReinspectionDto[]`.
   *
   * @param ncrId - UUID of the report.
   * @returns The parsed {@link Reinspection} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getByNcr(ncrId: string): Promise<Reinspection[]> {
    const data = await api.get<ApiResponse>(
      `${NCR_BASE}/${ncrId}/reinspections`
    );
    return safeParseReinspections(data);
  },

  /**
   * Fetches a single attempt by id.
   *
   * `GET /inspections/web/reinspections/{id}`
   *
   * @param id - UUID of the attempt.
   * @returns The {@link Reinspection}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<Reinspection> {
    const data = await api.get<ApiResponse>(
      `${INSPECTION_BASE}/reinspections/${id}`
    );
    return safeParseReinspection(data);
  },

  /**
   * Schedules a re-check of an NCR's corrective work.
   *
   * `POST /ncrs/web/{ncrId}/reinspections` → `ReinspectionDto` (full). Creates
   * the attempt and a new inspection cloned from the original with its failed
   * check points reset. The NCR must be in `corrective-action-complete`.
   *
   * @param ncrId - UUID of the report.
   * @param req - Inspector, due date and whether to copy every item. Optional.
   * @returns The created {@link Reinspection}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async scheduleForNcr(
    ncrId: string,
    req?: ScheduleReinspectionRequest
  ): Promise<Reinspection> {
    const data = await api.post<ApiResponse>(
      `${NCR_BASE}/${ncrId}/reinspections`,
      scheduleReinspectionToJson(req)
    );
    return safeParseReinspection(data);
  },

  /**
   * Schedules a re-check of a defect that has no NCR of its own.
   *
   * `POST /inspections/web/defects/{defectId}/reinspections` →
   * `ReinspectionDto` (full). Same clone as the NCR path; the defect must be
   * `resolved`.
   *
   * @param defectId - UUID of the defect row.
   * @param req - Inspector, due date and whether to copy every item. Optional.
   * @returns The created {@link Reinspection}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async scheduleForDefect(
    defectId: string,
    req?: ScheduleReinspectionRequest
  ): Promise<Reinspection> {
    const data = await api.post<ApiResponse>(
      `${INSPECTION_BASE}/defects/${defectId}/reinspections`,
      scheduleReinspectionToJson(req)
    );
    return safeParseReinspection(data);
  },

  /**
   * Records what the re-check found.
   *
   * `POST /inspections/web/reinspections/{id}/outcome` → `ReinspectionDto`
   * (full). A `passed` outcome is what an NCR verification can then name; a
   * `failed` one sends the NCR back to `rejected`. Needs the sign-off
   * permission, the same as verify.
   *
   * @param id - UUID of the attempt.
   * @param req - The outcome and what was seen.
   * @returns The updated {@link Reinspection}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async recordOutcome(
    id: string,
    req: ReinspectionOutcomeRequest
  ): Promise<Reinspection> {
    const data = await api.post<ApiResponse>(
      `${INSPECTION_BASE}/reinspections/${id}/outcome`,
      reinspectionOutcomeToJson(req)
    );
    return safeParseReinspection(data);
  },
};
