/**
 * @module wbs-service
 *
 * Typed client for a project's schedule on the WBS web endpoints
 * (`/project/{projectId}/wbs/web`, the twin the web app talks to).
 *
 * Endpoints:
 * - `GET    /project/{projectId}/wbs/web/schedule`                    activities + links
 * - `POST   /project/{projectId}/wbs/web`                             add an activity
 * - `PUT    /project/{projectId}/wbs/web/{elementId}`                 partial update
 * - `DELETE /project/{projectId}/wbs/web/{elementId}`                 delete (refused once inspected)
 * - `POST   /project/{projectId}/wbs/web/dependencies`                link two activities
 * - `DELETE /project/{projectId}/wbs/web/dependencies/{dependencyId}` remove a link
 *
 * Any member of the organization reads; the system admin and the project
 * manager write. Every function throws {@link ApiError} on a non-2xx
 * response or a parse failure.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  CreateWbsActivityRequest,
  CreateWbsDependencyRequest,
  UpdateWbsActivityRequest,
  WbsActivity,
  WbsDependency,
  WbsSchedule,
  parseWbsActivity,
  parseWbsDependency,
  parseWbsSchedule,
} from '../types/wbs/wbs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function base(projectId: number): string {
  return `/project/${projectId}/wbs/web`;
}

function parseWith<T>(what: string, data: unknown, parse: (raw: unknown) => T): T {
  try {
    return parse(data);
  } catch (error) {
    logger.error(`Failed to parse ${what}:`, error);
    throw new ApiError(`Failed to process ${what} data. Please try again.`, 422);
  }
}

export const wbsService = {
  /** `GET /project/{projectId}/wbs/web/schedule`: every activity and link. */
  async getSchedule(projectId: number): Promise<WbsSchedule> {
    const data = await api.get<ApiResponse>(`${base(projectId)}/schedule`);
    return parseWith('schedule', data, parseWbsSchedule);
  },

  /** `POST /project/{projectId}/wbs/web`: adds an activity. */
  async createActivity(projectId: number, req: CreateWbsActivityRequest): Promise<WbsActivity> {
    const payload: Record<string, unknown> = {};
    payload.wbsCode = req.wbsCode;
    payload.title = req.title;
    if (req.description !== undefined) payload.description = req.description;
    if (req.parentId !== undefined) payload.parentId = req.parentId;
    if (req.sortOrder !== undefined) payload.sortOrder = req.sortOrder;
    if (req.startDate !== undefined) payload.startDate = req.startDate;
    if (req.endDate !== undefined) payload.endDate = req.endDate;
    if (req.budgetedCost !== undefined) payload.budgetedCost = req.budgetedCost;
    if (req.weight !== undefined) payload.weight = req.weight;
    if (req.isMilestone !== undefined) payload.isMilestone = req.isMilestone;
    if (req.responsibleEmployeeId !== undefined) payload.responsibleEmployeeId = req.responsibleEmployeeId;
    if (req.responsibleSubContractId !== undefined) payload.responsibleSubContractId = req.responsibleSubContractId;
    const data = await api.post<ApiResponse>(`/project/${projectId}/wbs/web`, payload);
    return parseWith('activity', data, parseWbsActivity);
  },

  /** `PUT /project/{projectId}/wbs/web/{elementId}`: changes only the fields given. */
  async updateActivity(
    projectId: number,
    elementId: number,
    req: UpdateWbsActivityRequest
  ): Promise<WbsActivity> {
    const payload: Record<string, unknown> = {};
    if (req.title !== undefined) payload.title = req.title;
    if (req.description !== undefined) payload.description = req.description;
    if (req.status !== undefined) payload.status = req.status;
    if (req.startDate !== undefined) payload.startDate = req.startDate;
    if (req.endDate !== undefined) payload.endDate = req.endDate;
    if (req.actualStartDate !== undefined) payload.actualStartDate = req.actualStartDate;
    if (req.actualEndDate !== undefined) payload.actualEndDate = req.actualEndDate;
    if (req.forecastEndDate !== undefined) payload.forecastEndDate = req.forecastEndDate;
    if (req.budgetedCost !== undefined) payload.budgetedCost = req.budgetedCost;
    if (req.weight !== undefined) payload.weight = req.weight;
    if (req.sortOrder !== undefined) payload.sortOrder = req.sortOrder;
    if (req.isMilestone !== undefined) payload.isMilestone = req.isMilestone;
    if (req.responsibleEmployeeId !== undefined) payload.responsibleEmployeeId = req.responsibleEmployeeId;
    if (req.responsibleSubContractId !== undefined) payload.responsibleSubContractId = req.responsibleSubContractId;
    const data = await api.put<ApiResponse>(`${base(projectId)}/${elementId}`, payload);
    return parseWith('activity', data, parseWbsActivity);
  },

  /**
   * `DELETE /project/{projectId}/wbs/web/{elementId}`: deletes the activity
   * and its sub-activities. Refused once progress has been recorded
   * against any of them.
   */
  async deleteActivity(projectId: number, elementId: number): Promise<void> {
    await api.delete<ApiResponse>(`${base(projectId)}/${elementId}`);
  },

  /** `POST /project/{projectId}/wbs/web/dependencies`: links two activities. */
  async addDependency(projectId: number, req: CreateWbsDependencyRequest): Promise<WbsDependency> {
    const payload: Record<string, unknown> = {};
    payload.predecessorId = req.predecessorId;
    payload.successorId = req.successorId;
    if (req.type !== undefined) payload.type = req.type;
    if (req.lagDays !== undefined) payload.lagDays = req.lagDays;
    const data = await api.post<ApiResponse>(`${base(projectId)}/dependencies`, payload);
    return parseWith('dependency', data, parseWbsDependency);
  },

  /** `DELETE /project/{projectId}/wbs/web/dependencies/{dependencyId}` */
  async removeDependency(projectId: number, dependencyId: number): Promise<void> {
    await api.delete<ApiResponse>(`${base(projectId)}/dependencies/${dependencyId}`);
  },
};
