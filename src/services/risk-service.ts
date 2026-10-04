/**
 * @module risk-service
 *
 * Typed client for a project's risk register (`/project/{projectId}/risks/web`,
 * the twin the web app talks to; `/project/{projectId}/risks` has the same
 * operations for the site phone).
 *
 * Endpoints:
 * - `GET    /project/{projectId}/risks/web`           the register, R-number order
 * - `GET    /project/{projectId}/risks/web/{id}`      one risk
 * - `POST   /project/{projectId}/risks/web`           record a risk
 * - `POST   /project/{projectId}/risks/web/import`    import risks, skipping known refs
 * - `PUT    /project/{projectId}/risks/web/{id}`      change a risk (409 on a stale version)
 * - `DELETE /project/{projectId}/risks/web/{id}`      remove a risk
 *
 * Every function throws {@link ApiError} on a non-2xx response or a parse
 * failure.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { Risk, RiskRequest, parseRisk, riskRequestToJson } from '../types/risk/risk';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function parseOne(data: unknown): Risk {
  try {
    return parseRisk(data);
  } catch (error) {
    logger.error('Failed to parse risk:', error);
    throw new ApiError('Failed to process risk data. Please try again.', 422);
  }
}

function parseMany(data: unknown): Risk[] {
  if (!Array.isArray(data)) {
    logger.error('Failed to parse risks: expected an array');
    throw new ApiError('Failed to process risk data. Please try again.', 422);
  }
  return data.map(parseOne);
}

export const riskService = {
  /** The project's whole register, in R-number order. */
  async list(projectId: number): Promise<Risk[]> {
    const data = await api.get<ApiResponse>(`/project/${projectId}/risks/web`);
    return parseMany(data);
  },

  /** One risk of the project. */
  async get(projectId: number, riskId: string): Promise<Risk> {
    const data = await api.get<ApiResponse>(`/project/${projectId}/risks/web/${riskId}`);
    return parseOne(data);
  },

  /** Records a risk with the project's next R-number. */
  async create(projectId: number, req: RiskRequest): Promise<Risk> {
    const payload = riskRequestToJson(req);
    const data = await api.post<ApiResponse>(`/project/${projectId}/risks/web`, payload);
    return parseOne(data);
  },

  /**
   * Imports risks in the order given. A risk whose `importRef` the project
   * already holds is skipped. Resolves to the risks actually added.
   */
  async importRisks(projectId: number, risks: RiskRequest[]): Promise<Risk[]> {
    const payload: Record<string, unknown> = {};
    payload.risks = risks.map(riskRequestToJson);
    const data = await api.post<ApiResponse>(`/project/${projectId}/risks/web/import`, payload);
    return parseMany(data);
  },

  /** Replaces a risk's fields. Pass `version` to be refused on a stale edit. */
  async update(projectId: number, riskId: string, req: RiskRequest): Promise<Risk> {
    const payload = riskRequestToJson(req);
    const data = await api.put<ApiResponse>(`/project/${projectId}/risks/web/${riskId}`, payload);
    return parseOne(data);
  },

  /** Removes a risk. */
  async delete(projectId: number, riskId: string): Promise<void> {
    await api.delete(`/project/${projectId}/risks/web/${riskId}`);
  },
};
