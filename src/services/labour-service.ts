/**
 * Backend response shape audit (per local-docs/backend-api-docs.md):
 *
 *   GET    /labour/web          → LabourDto[]     (full list)
 *   GET    /labour/web/{id}     → LabourDto        (full)
 *   POST   /labour/web          → LabourSimpleDto  (partial — adds org/project context, labourId casing differs from LabourDto)
 *   PATCH  /labour/web/{id}     → ApiResponse      (ack only)
 *   DELETE /labour/web/{id}     → ApiResponse      (ack only)
 *
 * LabourSimpleDto carries no nested arrays; parseLabour normalises the
 * labourID vs labourId key difference between the two read shapes. The create
 * caller seeds the detail cache with the SimpleDto response and immediately
 * invalidates it so the next observer refetches the full LabourDto.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { parseLabour } from '../types/labour';
import type {
  Labour,
  LabourCreateRequest,
  LabourUpdateRequest,
} from '../types/labour';

type ApiResponse = Record<string, unknown>;

function safeParseLabour(data: ApiResponse): Labour {
  try {
    return parseLabour(data);
  } catch (error) {
    logger.error('Failed to parse labour data:', error);
    throw new ApiError('Failed to process labour data. Please try again.', 422);
  }
}

function safeParseLabours(data: ApiResponse[]): Labour[] {
  try {
    return data.map((item) => parseLabour(item));
  } catch (error) {
    logger.error('Failed to parse labour list:', error);
    throw new ApiError('Failed to process labour data. Please try again.', 422);
  }
}

export const labourService = {
  async getAll(): Promise<Labour[]> {
    const data = await api.get<ApiResponse[]>('/labour/web');
    return safeParseLabours(data);
  },

  async getById(id: number): Promise<Labour> {
    const data = await api.get<ApiResponse>(`/labour/web/${id}`);
    return safeParseLabour(data);
  },

  async create(request: LabourCreateRequest): Promise<Labour> {
    const data = await api.post<ApiResponse>('/labour/web', request);
    return safeParseLabour(data);
  },

  async update(id: number, request: LabourUpdateRequest): Promise<void> {
    await api.patch(`/labour/web/${id}`, request);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/labour/web/${id}`);
  },
};
