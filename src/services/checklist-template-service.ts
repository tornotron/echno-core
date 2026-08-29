/**
 * @module checklist-template-service
 *
 * Typed client for the checklist-template endpoints
 * (`/checklist-templates/web`, resolved against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /checklist-templates/web`                       → `ChecklistTemplateDto` (full)
 * - `GET  /checklist-templates/web/{id}`                  → `ChecklistTemplateDto` (query)
 * - `GET  /checklist-templates/web`                       → `Page<ChecklistTemplateDto>` (list)
 * - `PUT  /checklist-templates/web/{id}`                  → `ChecklistTemplateDto` (full)
 * - `GET  /checklist-templates/web/starters`              → `StarterChecklistTemplateDto[]` (list)
 * - `POST /checklist-templates/web/starters/{trade}/adopt`→ `ChecklistTemplateDto` (full)
 *
 * There is no delete. A template that has stopped being used is deactivated by
 * sending `active: false` on an update, which keeps the inspections created from
 * it explicable rather than orphaning them.
 *
 * The list endpoint returns a Spring `Page`; {@link getAll} unwraps `.content`.
 * The starters endpoint is unpaged, because the starter set is product-supplied
 * and small.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  ChecklistTemplate,
  ChecklistTemplateRequest,
  checklistTemplateToJson,
  InspectionTrade,
  parseChecklistTemplate,
  parseStarterChecklistTemplate,
  StarterChecklistTemplate,
} from '../types/inspection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/checklist-templates/web';

/** Optional filters for the template list. */
export interface ChecklistTemplateListParams {
  /** Restrict to one trade (hyphenated wire value, e.g. `reinforcement`). */
  trade?: string;
  /** Restrict to active or inactive templates. */
  active?: boolean;
  /** Zero-based page number. */
  page?: number;
  /** Page size. */
  size?: number;
}

/** Safely parse a template, converting parse failures into a 422 ApiError. */
function safeParseTemplate(data: ApiResponse): ChecklistTemplate {
  try {
    return parseChecklistTemplate(data);
  } catch (error) {
    logger.error('Failed to parse checklist template data:', error);
    throw new ApiError(
      'Failed to process checklist template data. Please try again.',
      422
    );
  }
}

/**
 * Unwraps a Spring `Page<ChecklistTemplateDto>` (or a bare array) into parsed
 * rows. Logs a warning and returns `[]` for any other shape so a partial outage
 * does not break consumers.
 */
function safeParseTemplates(data: ApiResponse): ChecklistTemplate[] {
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (!Array.isArray(data) && !Array.isArray(data?.content)) {
    logger.warn('Checklist templates API returned unexpected format:', {
      type: typeof data,
      keys: data ? Object.keys(data) : null,
    });
    return [];
  }
  try {
    return items.map((item) => parseChecklistTemplate(item));
  } catch (error) {
    logger.error('Failed to parse checklist templates data:', error);
    throw new ApiError(
      'Failed to process checklist templates data. Please try again.',
      422
    );
  }
}

/** Builds the query object, omitting every filter the caller left unset. */
function toQuery(
  params: ChecklistTemplateListParams
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.trade !== undefined) query.trade = params.trade;
  if (params.active !== undefined) query.active = params.active;
  if (params.page !== undefined) query.page = params.page;
  if (params.size !== undefined) query.size = params.size;
  return query;
}

/** Checklist Template Service — the reusable per-trade check-point lists. */
export const checklistTemplateService = {
  /**
   * Lists the organization's templates, optionally filtered.
   *
   * `GET /checklist-templates/web` → `Page<ChecklistTemplateDto>`. The Spring
   * page envelope is unwrapped to a plain array of parsed rows.
   *
   * @param params - Optional `trade` / `active` filters and paging.
   * @returns The parsed {@link ChecklistTemplate} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getAll(
    params: ChecklistTemplateListParams = {}
  ): Promise<ChecklistTemplate[]> {
    const data = await api.get<ApiResponse>(BASE, toQuery(params));
    return safeParseTemplates(data);
  },

  /**
   * Fetches a single template by id.
   *
   * `GET /checklist-templates/web/{id}`
   *
   * @param id - UUID of the template.
   * @returns The {@link ChecklistTemplate}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<ChecklistTemplate> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseTemplate(data);
  },

  /**
   * Defines a template for a trade.
   *
   * `POST /checklist-templates/web` → `ChecklistTemplateDto` (full). One trade
   * carries one template, so this answers 409 when the organization already has
   * one for the trade.
   *
   * @param req - Template fields ({@link ChecklistTemplateRequest}).
   * @returns The created {@link ChecklistTemplate}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(req: ChecklistTemplateRequest): Promise<ChecklistTemplate> {
    const data = await api.post<ApiResponse>(BASE, checklistTemplateToJson(req));
    return safeParseTemplate(data);
  },

  /**
   * Replaces a template (full replacement) and bumps its version.
   *
   * `PUT /checklist-templates/web/{id}` → `ChecklistTemplateDto` (full). The
   * check points are rebuilt from the payload, so a save carries the whole list
   * rather than a delta. The trade is fixed at creation and must be sent
   * unchanged; a different one is rejected with a 400.
   *
   * @param id - UUID of the template.
   * @param req - Replacement fields ({@link ChecklistTemplateRequest}).
   * @returns The updated {@link ChecklistTemplate}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(
    id: string,
    req: ChecklistTemplateRequest
  ): Promise<ChecklistTemplate> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}`,
      checklistTemplateToJson(req)
    );
    return safeParseTemplate(data);
  },

  /**
   * Lists the starter checklists on offer.
   *
   * `GET /checklist-templates/web/starters` →
   * `StarterChecklistTemplateDto[]`. Global reference data, identical for every
   * organization and unpaged.
   *
   * @returns The available {@link StarterChecklistTemplate} rows.
   * @throws {ApiError} On non-2xx responses or if a row fails to parse.
   */
  async getStarters(): Promise<StarterChecklistTemplate[]> {
    const data = await api.get<ApiResponse>(`${BASE}/starters`);
    if (!Array.isArray(data)) {
      logger.warn('Starter checklists API returned unexpected format:', {
        type: typeof data,
        keys: data ? Object.keys(data) : null,
      });
      return [];
    }
    try {
      return data.map((item: unknown) => parseStarterChecklistTemplate(item));
    } catch (error) {
      logger.error('Failed to parse starter checklist data:', error);
      throw new ApiError(
        'Failed to process starter checklist data. Please try again.',
        422
      );
    }
  },

  /**
   * Adopts a starter checklist as the organization's own editable template.
   *
   * `POST /checklist-templates/web/starters/{trade}/adopt` →
   * `ChecklistTemplateDto` (full), 201. The copy is a snapshot: later revisions
   * of the starter do not reach into it. Answers 404 when no starter exists for
   * the trade, and 409 when the organization already has a template for it.
   *
   * @param trade - The trade to adopt, sent as its hyphenated wire value.
   * @returns The created {@link ChecklistTemplate}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async adoptStarter(trade: InspectionTrade): Promise<ChecklistTemplate> {
    const data = await api.post<ApiResponse>(
      `${BASE}/starters/${encodeURIComponent(trade)}/adopt`,
      {}
    );
    return safeParseTemplate(data);
  },
};
