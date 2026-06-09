import { StorageLocationType } from './storage-location';

export interface CreateStorageLocationRequest {
  locationName: string;
  locationType: StorageLocationType;
  address?: string;
  projectId?: number;
  projectName?: string;
  capacity?: number;
  latitude?: number;
  longitude?: number;
  active?: boolean;
}

export function createStorageLocationToJson(
  dto: CreateStorageLocationRequest
): Record<string, unknown> {
  return {
    locationName: dto.locationName,
    locationType: dto.locationType,
    address: dto.address ?? null,
    projectId: dto.projectId ?? null,
    projectName: dto.projectName ?? null,
    capacity: dto.capacity ?? null,
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
    active: dto.active ?? true,
  };
}
