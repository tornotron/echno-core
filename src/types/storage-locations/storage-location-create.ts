/**
 * @module storage-location-create
 *
 * Request shape for creating a storage location and the serializer that
 * converts it into the backend's expected JSON body.
 *
 * @see {@link StorageLocation} for the response domain type.
 */
import { StorageLocationType } from './storage-location';

/**
 * Payload for `POST /storage-locations/web`. Mirrors the writable fields of
 * {@link StorageLocation}; server-computed fields (`id`, `storageItemsCount`)
 * are omitted.
 */
export interface CreateStorageLocationRequest {
  /** Display name of the new location. Required. */
  locationName: string;

  /** Classification of the new location. Required. */
  locationType: StorageLocationType;

  /** Free-form postal or descriptive address. */
  address?: string;

  /** Owning project ID, when {@link locationType} ties the location to a project. */
  projectId?: number;

  /** Denormalized project name for backend convenience. */
  projectName?: string;

  /** Maximum storage capacity in domain-specific units. */
  capacity?: number;

  /** Geographic latitude (decimal degrees). */
  latitude?: number;

  /** Geographic longitude (decimal degrees). */
  longitude?: number;

  /**
   * Whether the new location should be active immediately. Defaults to
   * `true` on the wire when omitted.
   */
  active?: boolean;
}

/**
 * Serializes a {@link CreateStorageLocationRequest} for the backend.
 *
 * Optional fields are sent as `null` rather than omitted so the backend's
 * deserializer sees an explicit value for every column. `active` defaults
 * to `true` when the caller didn't supply it.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
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
