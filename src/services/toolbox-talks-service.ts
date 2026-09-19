/**
 * @module toolbox-talks-service
 *
 * Typed client for the Toolbox Talks web endpoints
 * (`/toolbox-talks/web`, the twin controller the web app talks to).
 *
 * Wraps `api.*` calls and parses raw JSON into typed
 * {@link ToolboxTalks} objects. Every function throws {@link ApiError}
 * on a non-2xx response or a parse failure.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  ToolboxTalks,
  ToolboxTalksListParams,
  ToolboxTalksPage,
  CreateToolboxTalksRequest,
  UpdateToolboxTalksRequest,
  parseToolboxTalks,
  parseToolboxTalksPage,
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

export const toolboxTalksService = {
  /** `GET /toolbox-talks/web`: one page of records. */
  async list(params: ToolboxTalksListParams = {}): Promise<ToolboxTalksPage> {
    const query: Record<string, string | number | boolean> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.page !== undefined) query.page = params.page;
    if (params.size !== undefined) query.size = params.size;
    const data = await api.get<ApiResponse>(BASE, query);
    return parseWith('Toolbox Talks list', data, parseToolboxTalksPage);
  },

  /** `GET /toolbox-talks/web/{id}` */
  async get(id: string): Promise<ToolboxTalks> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return parseWith('Toolbox Talks', data, parseToolboxTalks);
  },

  /** `POST /toolbox-talks/web` */
  async create(req: CreateToolboxTalksRequest): Promise<ToolboxTalks> {
    const data = await api.post<ApiResponse>(BASE, req);
    return parseWith('Toolbox Talks', data, parseToolboxTalks);
  },

  /** `PUT /toolbox-talks/web/{id}` */
  async update(id: string, req: UpdateToolboxTalksRequest): Promise<ToolboxTalks> {
    const data = await api.put<ApiResponse>(`${BASE}/${id}`, req);
    return parseWith('Toolbox Talks', data, parseToolboxTalks);
  },
};
