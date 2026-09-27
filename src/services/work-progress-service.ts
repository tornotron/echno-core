/**
 * @module work-progress-service
 *
 * Typed client for the Work Progress module's progress inspections
 * (`/progress-inspections/web`, the twin the web app talks to; the site
 * phone uses `/progress-inspections` with the same operations).
 *
 * Endpoints:
 * - `GET  /progress-inspections/web`                          paged list
 * - `GET  /progress-inspections/web/{id}`                     one record
 * - `POST /progress-inspections/web`                          record and apply
 * - `GET  /progress-inspections/web/{id}/evidence`            evidence
 * - `POST /progress-inspections/web/{id}/evidence/presign`    step 1 of upload
 * - `POST /progress-inspections/web/{id}/evidence/register`   step 3 of upload
 *
 * Every function throws {@link ApiError} on a non-2xx response or a parse
 * failure.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Attachment,
  PresignedUpload,
  RegisterUploadRequest,
  UploadRequest,
  parseAttachment,
  parsePresignedUpload,
} from '../types/attachment';
import {
  ProgressInspection,
  ProgressInspectionListParams,
  ProgressInspectionPage,
  RecordProgressInspectionRequest,
  parseProgressInspection,
  parseProgressInspectionPage,
} from '../types/work-progress/work-progress';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/progress-inspections/web';

function parseWith<T>(what: string, data: unknown, parse: (raw: unknown) => T): T {
  try {
    return parse(data);
  } catch (error) {
    logger.error(`Failed to parse ${what}:`, error);
    throw new ApiError(`Failed to process ${what} data. Please try again.`, 422);
  }
}

function parseArrayWith<T>(what: string, data: unknown, parse: (raw: unknown) => T): T[] {
  if (!Array.isArray(data)) {
    logger.error(`Failed to parse ${what}: expected an array`);
    throw new ApiError(`Failed to process ${what} data. Please try again.`, 422);
  }
  return data.map((item) => parseWith(what, item, parse));
}

export const workProgressService = {
  /** `GET /progress-inspections/web`: one page, newest first. */
  async list(params: ProgressInspectionListParams = {}): Promise<ProgressInspectionPage> {
    const query: Record<string, string | number | boolean> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.wbsElementId !== undefined) query.wbsElementId = params.wbsElementId;
    if (params.pageNo !== undefined) query.pageNo = params.pageNo;
    if (params.pageSize !== undefined) query.pageSize = params.pageSize;
    const data = await api.get<ApiResponse>(BASE, query);
    return parseWith('progress inspection list', data, parseProgressInspectionPage);
  },

  /** `GET /progress-inspections/web/{id}` */
  async get(id: string): Promise<ProgressInspection> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return parseWith('progress inspection', data, parseProgressInspection);
  },

  /**
   * `POST /progress-inspections/web`: records the inspection and applies it
   * to the activity. Final once saved.
   */
  async record(req: RecordProgressInspectionRequest): Promise<ProgressInspection> {
    const payload: Record<string, unknown> = {};
    payload.wbsElementId = req.wbsElementId;
    payload.inspectionDate = req.inspectionDate;
    payload.outcome = req.outcome;
    if (req.percentComplete !== undefined) payload.percentComplete = req.percentComplete;
    if (req.actualStartDate !== undefined) payload.actualStartDate = req.actualStartDate;
    if (req.actualFinishDate !== undefined) payload.actualFinishDate = req.actualFinishDate;
    if (req.forecastFinishDate !== undefined) payload.forecastFinishDate = req.forecastFinishDate;
    if (req.delayReason !== undefined) payload.delayReason = req.delayReason;
    if (req.delayNotes !== undefined) payload.delayNotes = req.delayNotes;
    if (req.spatialNodeId !== undefined) payload.spatialNodeId = req.spatialNodeId;
    if (req.remarks !== undefined) payload.remarks = req.remarks;
    const data = await api.post<ApiResponse>(BASE, payload);
    return parseWith('progress inspection', data, parseProgressInspection);
  },

  /** `GET /progress-inspections/web/{id}/evidence` */
  async getEvidence(id: string): Promise<Attachment[]> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}/evidence`);
    return parseArrayWith('progress inspection evidence', data, parseAttachment);
  },

  /** Step 1 of the direct-to-storage evidence flow: one slot per file. */
  async presignEvidence(id: string, requests: UploadRequest[]): Promise<PresignedUpload[]> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/evidence/presign`, requests);
    return parseArrayWith('progress inspection evidence slot', data, parsePresignedUpload);
  },

  /** Step 3 of the direct-to-storage evidence flow: confirm the uploaded keys. */
  async registerEvidence(id: string, requests: RegisterUploadRequest[]): Promise<Attachment[]> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/evidence/register`, requests);
    return parseArrayWith('progress inspection evidence', data, parseAttachment);
  },
};
