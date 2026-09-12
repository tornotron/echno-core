/**
 * @module trade-service
 *
 * Typed client for the inspection ontology catalogues
 * (`/inspections/web/trades` and `/inspections/web/element-types`, resolved
 * against the `/api/v1` base; tornotron/echno-backend#769, #777, #779).
 *
 * Each catalogue has a product-shipped, read-only list and the organization's
 * own copy of it, which is what pickers render and what an admin extends.
 * Management needs `inspections.checklists.define`, the same authority as the
 * checklist builder. Rows are deactivated, never deleted.
 *
 * All functions throw {@link ApiError} on non-2xx responses or parse failures.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  CreateElementTypeRequest,
  CreateTradeRequest,
  ElementTypeCatalogueEntry,
  OrgElementType,
  OrgTrade,
  TradeCatalogueEntry,
  UpdateElementTypeRequest,
  UpdateTradeRequest,
  createCatalogueRowToJson,
  parseElementTypeCatalogueEntry,
  parseOrgElementType,
  parseOrgTrade,
  parseTradeCatalogueEntry,
  updateCatalogueRowToJson,
} from '../types/inspection/trade';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const TRADES = '/inspections/web/trades';
const ELEMENT_TYPES = '/inspections/web/element-types';

function failed(what: string, error: unknown): ApiError {
  logger.error(`Failed to parse ${what}:`, error);
  return new ApiError(`Failed to process ${what} data. Please try again.`, 422);
}

function parseList<T>(
  data: ApiResponse,
  what: string,
  parse: (item: unknown) => T
): T[] {
  if (!Array.isArray(data)) {
    throw failed(what, new Error('Expected an array'));
  }
  try {
    return data.map((item: unknown) => parse(item));
  } catch (error) {
    throw failed(what, error);
  }
}

function parseOne<T>(
  data: ApiResponse,
  what: string,
  parse: (item: unknown) => T
): T {
  try {
    return parse(data);
  } catch (error) {
    throw failed(what, error);
  }
}

function listQuery(
  includeInactive: boolean
): Record<string, string | number | boolean> {
  return includeInactive ? { includeInactive: true } : {};
}

export const tradeService = {
  /**
   * The organization's trades: catalogue copies and org-defined rows, active
   * only unless asked otherwise.
   *
   * `GET /inspections/web/trades?includeInactive=` → `OrgTradeDto[]`.
   */
  async list(includeInactive = false): Promise<OrgTrade[]> {
    const data = await api.get<ApiResponse>(TRADES, listQuery(includeInactive));
    return parseList(data, 'trade', parseOrgTrade);
  },

  /**
   * The product-shipped trade catalogue, read only.
   *
   * `GET /inspections/web/trades/catalogue` → `TradeCatalogueDto[]`.
   */
  async catalogue(): Promise<TradeCatalogueEntry[]> {
    const data = await api.get<ApiResponse>(`${TRADES}/catalogue`);
    return parseList(data, 'trade catalogue', parseTradeCatalogueEntry);
  },

  /**
   * Defines an organization's own trade. Answers 409 when the code is taken.
   *
   * `POST /inspections/web/trades` → `OrgTradeDto`, 201.
   */
  async create(req: CreateTradeRequest): Promise<OrgTrade> {
    const data = await api.post<ApiResponse>(TRADES, createCatalogueRowToJson(req));
    return parseOne(data, 'trade', parseOrgTrade);
  },

  /**
   * Renames, regroups, reorders or deactivates a trade; omitted fields are
   * left as they are and the code never changes.
   *
   * `PATCH /inspections/web/trades/{id}` → `OrgTradeDto`.
   */
  async update(id: string, req: UpdateTradeRequest): Promise<OrgTrade> {
    const data = await api.patch<ApiResponse>(
      `${TRADES}/${id}`,
      updateCatalogueRowToJson(req)
    );
    return parseOne(data, 'trade', parseOrgTrade);
  },
};

export const elementTypeService = {
  /**
   * The organization's element types, active only unless asked otherwise.
   *
   * `GET /inspections/web/element-types?includeInactive=` → `OrgElementTypeDto[]`.
   */
  async list(includeInactive = false): Promise<OrgElementType[]> {
    const data = await api.get<ApiResponse>(
      ELEMENT_TYPES,
      listQuery(includeInactive)
    );
    return parseList(data, 'element type', parseOrgElementType);
  },

  /**
   * The product-shipped element type catalogue, read only.
   *
   * `GET /inspections/web/element-types/catalogue` → `ElementTypeCatalogueDto[]`.
   */
  async catalogue(): Promise<ElementTypeCatalogueEntry[]> {
    const data = await api.get<ApiResponse>(`${ELEMENT_TYPES}/catalogue`);
    return parseList(
      data,
      'element type catalogue',
      parseElementTypeCatalogueEntry
    );
  },

  /**
   * Defines an organization's own element type. Answers 409 when the code is
   * taken.
   *
   * `POST /inspections/web/element-types` → `OrgElementTypeDto`, 201.
   */
  async create(req: CreateElementTypeRequest): Promise<OrgElementType> {
    const data = await api.post<ApiResponse>(
      ELEMENT_TYPES,
      createCatalogueRowToJson(req)
    );
    return parseOne(data, 'element type', parseOrgElementType);
  },

  /**
   * Renames, regroups, reorders or deactivates an element type; the code
   * never changes.
   *
   * `PATCH /inspections/web/element-types/{id}` → `OrgElementTypeDto`.
   */
  async update(
    id: string,
    req: UpdateElementTypeRequest
  ): Promise<OrgElementType> {
    const data = await api.patch<ApiResponse>(
      `${ELEMENT_TYPES}/${id}`,
      updateCatalogueRowToJson(req)
    );
    return parseOne(data, 'element type', parseOrgElementType);
  },
};
