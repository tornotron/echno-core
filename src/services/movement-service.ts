/**
 * services/movement-service.ts
 *
 * Typed client for the movement-record endpoints
 * (`/api/v1/movement-records/web`). DTO conversion lives in
 * `types/attendance/movement-create.ts`.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  MovementType,
  createMovementToJson,
  type MovementRecord,
  type CreateMovementRequest,
} from '../types/attendance';

// ─── Parser ───────────────────────────────────────────────────────────────────

const MOVEMENT_FROM_BACKEND: Record<string, MovementType> = {
  SITE_TRAVEL: MovementType.siteTravel,
  CLIENT_MEETING: MovementType.clientMeeting,
  VENDOR_MEETING: MovementType.vendorMeeting,
  WORK_FROM_HOME: MovementType.workFromHome,
  ON_FIELD_WORK: MovementType.onFieldWork,
  TRAINING: MovementType.training,
  OFFICE_WORK: MovementType.officeWork,
  INSPECTION: MovementType.inspection,
  MATERIAL_PROCUREMENT: MovementType.materialProcurement,
  SUPERVISORY_VISIT: MovementType.supervisoryVisit,
  OTHER: MovementType.other,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMovement(raw: any): MovementRecord {
  return {
    id: raw.id ?? 0,
    attendanceId: raw.attendanceId ?? 0,
    employeeId: raw.employeeId ?? 0,
    employeeName: raw.employeeName ?? '',
    movementType: MOVEMENT_FROM_BACKEND[raw.movementType] ?? MovementType.other,
    fromLocation: raw.fromLocation ?? '',
    toLocation: raw.toLocation ?? undefined,
    startTime: new Date(raw.startTime),
    endTime: raw.endTime ? new Date(raw.endTime) : undefined,
    durationMinutes: raw.durationMinutes ?? undefined,
    distance: raw.distanceKm ?? undefined,
    purpose: raw.purpose ?? '',
    remarks: raw.remarks ?? undefined,
    startLatitude: raw.startLatitude ?? undefined,
    startLongitude: raw.startLongitude ?? undefined,
    endLatitude: raw.endLatitude ?? undefined,
    endLongitude: raw.endLongitude ?? undefined,
    verifiedBy: raw.verifiedBy ?? undefined,
    verifiedAt: raw.verifiedAt ? new Date(raw.verifiedAt) : undefined,
    isVerified: raw.isVerified ?? false,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : undefined,
    createdAt: new Date(raw.createdAt ?? Date.now()),
    updatedAt: new Date(raw.updatedAt ?? Date.now()),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeMovement(raw: any): MovementRecord {
  try {
    return parseMovement(raw);
  } catch (error) {
    logger.error('Failed to parse movement record:', error);
    throw new ApiError('Failed to process movement record data.', 422);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeMovements(data: any[]): MovementRecord[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((element) => parseMovement(element));
  } catch (error) {
    logger.error('Failed to parse movement record list:', error);
    throw new ApiError('Failed to process movement record data.', 422);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export const movementService = {
  /**
   * Logs a new off-site movement against an attendance day.
   *
   * `POST /movement-records/web?employeeId={employeeId}` → `MovementRecordDto`
   * (full). The author identity is sent on the query string.
   *
   * @param dto - Movement details ({@link CreateMovementRequest}).
   * @param employeeId - Surrogate id of the logging employee.
   * @returns The created {@link MovementRecord}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async logMovement(
    dto: CreateMovementRequest,
    employeeId: number
  ): Promise<MovementRecord> {
    const data = await api.post<Raw>(
      '/movement-records/web',
      createMovementToJson(dto),
      { employeeId }
    );
    return safeMovement(data);
  },

  /**
   * Fetches all movement records logged against an attendance day.
   *
   * `GET /movement-records/web/attendance/{attendanceId}`
   *
   * @param attendanceId - Surrogate id of the parent attendance record.
   * @returns The matching {@link MovementRecord} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getMovementsByAttendance(
    attendanceId: number
  ): Promise<MovementRecord[]> {
    const data = await api.get<Raw[]>(
      `/movement-records/web/attendance/${attendanceId}`
    );
    return safeMovements(data);
  },

  /**
   * Fetches a single movement record by id.
   *
   * `GET /movement-records/web/{id}`
   *
   * @param id - Surrogate id of the movement record.
   * @returns The {@link MovementRecord}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getMovementById(id: number): Promise<MovementRecord> {
    const data = await api.get<Raw>(`/movement-records/web/${id}`);
    return safeMovement(data);
  },

  /**
   * Marks a movement record as verified by an approver.
   *
   * `POST /movement-records/web/{id}/verify?verifiedBy={verifiedBy}` →
   * `MovementRecordDto` (full).
   *
   * @param id - Surrogate id of the movement record.
   * @param verifiedBy - Name/identifier of the verifying approver.
   * @returns The updated {@link MovementRecord}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async verifyMovement(
    id: number,
    verifiedBy: string
  ): Promise<MovementRecord> {
    const data = await api.post<Raw>(
      `/movement-records/web/${id}/verify`,
      null,
      { verifiedBy }
    );
    return safeMovement(data);
  },
};
