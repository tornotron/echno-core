/**
 * services/storage-locations-service.ts
 *
 * Typed client for storage location backend endpoints.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  StorageLocation,
  parseStorageLocation,
  CreateStorageLocationRequest,
  createStorageLocationToJson,
  UpdateStorageLocationRequest,
  updateStorageLocationToJson,
} from '../types/storage-locations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function safeParse(data: Raw): StorageLocation {
  try {
    return parseStorageLocation(data);
  } catch (error) {
    logger.error('Failed to parse storage location:', error);
    throw new ApiError('Failed to process storage location data.', 422);
  }
}

function extractArray(data: Raw): Raw[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  logger.warn('Storage locations API returned unexpected format:', {
    type: typeof data,
    keys: data ? Object.keys(data) : null,
  });
  return [];
}

function safeParseAll(data: Raw): StorageLocation[] {
  const items = extractArray(data);
  if (items.length === 0) return [];
  try {
    return items.map((item) => parseStorageLocation(item));
  } catch (error) {
    logger.error('Failed to parse storage locations:', error);
    throw new ApiError('Failed to process storage locations data.', 422);
  }
}

export const storageLocationsService = {
  async getAll(): Promise<StorageLocation[]> {
    const data = await api.get<Raw>('/storage-locations/web');
    return safeParseAll(data);
  },

  async getById(id: number): Promise<StorageLocation> {
    const data = await api.get<Raw>(`/storage-locations/web/${id}`);
    return safeParse(data);
  },

  async create(dto: CreateStorageLocationRequest): Promise<StorageLocation> {
    const data = await api.post<Raw>(
      '/storage-locations/web',
      createStorageLocationToJson(dto)
    );
    return safeParse(data);
  },

  async update(
    id: number,
    dto: UpdateStorageLocationRequest
  ): Promise<StorageLocation> {
    const data = await api.patch<Raw>(
      `/storage-locations/web/${id}`,
      updateStorageLocationToJson(dto)
    );
    return safeParse(data);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/storage-locations/web/${id}`);
  },
};
