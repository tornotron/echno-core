/**
 * @module toolbox-talks-service
 *
 * Typed client for the Toolbox Talks web endpoints
 * (`/toolbox-talks/web`, the twin controller the web app talks to; the
 * supervisor's phone uses `/toolbox-talks` with the same operations).
 *
 * Endpoints:
 * - `GET    /toolbox-talks/web`                          paged list
 * - `GET    /toolbox-talks/web/{id}`                     one talk
 * - `POST   /toolbox-talks/web`                          draft a talk
 * - `PUT    /toolbox-talks/web/{id}`                     change a draft
 * - `POST   /toolbox-talks/web/{id}/attendees`           add attendees
 * - `DELETE /toolbox-talks/web/{id}/attendees/{employeeId}`
 * - `POST   /toolbox-talks/web/{id}/record`              record, once
 * - `GET    /toolbox-talks/web/{id}/photos`              evidence
 * - `POST   /toolbox-talks/web/{id}/photos/presign`      step 1 of upload
 * - `POST   /toolbox-talks/web/{id}/photos/register`     step 3 of upload
 * - `GET    /toolbox-talks/web/{id}/pdf`                 one-page record
 *
 * Wraps `api.*` calls and parses raw JSON into typed {@link ToolboxTalk}
 * objects. Every function throws {@link ApiError} on a non-2xx response
 * or a parse failure.
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
  CreateToolboxTalkRequest,
  ToolboxTalk,
  ToolboxTalkAttendeesRequest,
  ToolboxTalkListParams,
  ToolboxTalkPage,
  UpdateToolboxTalkRequest,
  parseToolboxTalk,
  parseToolboxTalkPage,
} from '../types/toolbox-talks/toolbox-talks';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/toolbox-talks/web';

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

function parseAttachments(data: unknown): Attachment[] {
  return parseArrayWith('toolbox talk photo', data, parseAttachment);
}

export const toolboxTalksService = {
  /** `GET /toolbox-talks/web`: one page of talks. */
  async list(params: ToolboxTalkListParams = {}): Promise<ToolboxTalkPage> {
    const query: Record<string, string | number | boolean> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.from !== undefined) query.from = params.from;
    if (params.to !== undefined) query.to = params.to;
    if (params.status !== undefined) query.status = params.status;
    if (params.pageNo !== undefined) query.pageNo = params.pageNo;
    if (params.pageSize !== undefined) query.pageSize = params.pageSize;
    const data = await api.get<ApiResponse>(BASE, query);
    return parseWith('toolbox talk list', data, parseToolboxTalkPage);
  },

  /** `GET /toolbox-talks/web/{id}` */
  async get(id: string): Promise<ToolboxTalk> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return parseWith('toolbox talk', data, parseToolboxTalk);
  },

  /** `POST /toolbox-talks/web`: drafts a talk. */
  async create(req: CreateToolboxTalkRequest): Promise<ToolboxTalk> {
    const data = await api.post<ApiResponse>(BASE, req);
    return parseWith('toolbox talk', data, parseToolboxTalk);
  },

  /** `PUT /toolbox-talks/web/{id}`: changes a draft. */
  async update(id: string, req: UpdateToolboxTalkRequest): Promise<ToolboxTalk> {
    const data = await api.put<ApiResponse>(`${BASE}/${id}`, req);
    return parseWith('toolbox talk', data, parseToolboxTalk);
  },

  /** `POST /toolbox-talks/web/{id}/attendees`: adds attendees to a draft. */
  async addAttendees(
    id: string,
    req: ToolboxTalkAttendeesRequest
  ): Promise<ToolboxTalk> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/attendees`, req);
    return parseWith('toolbox talk', data, parseToolboxTalk);
  },

  /** `DELETE /toolbox-talks/web/{id}/attendees/{employeeId}` */
  async removeAttendee(id: string, employeeId: number): Promise<ToolboxTalk> {
    const data = await api.delete<ApiResponse>(
      `${BASE}/${id}/attendees/${employeeId}`
    );
    return parseWith('toolbox talk', data, parseToolboxTalk);
  },

  /**
   * `POST /toolbox-talks/web/{id}/record`: records the draft. Needs at
   * least one attendee and happens once; the backend refuses a second call.
   */
  async record(id: string): Promise<ToolboxTalk> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/record`);
    return parseWith('toolbox talk', data, parseToolboxTalk);
  },

  /** `GET /toolbox-talks/web/{id}/photos`: the registered evidence. */
  async getPhotos(id: string): Promise<Attachment[]> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}/photos`);
    return parseAttachments(data);
  },

  /**
   * Step 1 of the direct-to-storage evidence flow: one presigned slot per
   * file, in request order.
   */
  async presignPhotos(
    id: string,
    requests: UploadRequest[]
  ): Promise<PresignedUpload[]> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/photos/presign`, requests);
    return parseArrayWith('toolbox talk photo slot', data, parsePresignedUpload);
  },

  /**
   * Step 3 of the direct-to-storage evidence flow: confirm the keys whose
   * PUT succeeded and cite them on the talk.
   */
  async registerPhotos(
    id: string,
    requests: RegisterUploadRequest[]
  ): Promise<Attachment[]> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/photos/register`, requests);
    return parseAttachments(data);
  },

  /** `GET /toolbox-talks/web/{id}/pdf`: the one-page talk record. */
  async downloadPdf(id: string): Promise<Blob> {
    return api.getBlob(`${BASE}/${id}/pdf`);
  },

  /** The path of the PDF, for an anchor that lets the browser download it. */
  pdfPath(id: string): string {
    return `${BASE}/${id}/pdf`;
  },
};
