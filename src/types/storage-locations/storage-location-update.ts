/**
 * @module storage-location-update
 *
 * Request shape for updating a storage location and the serializer that
 * converts it into the backend's expected JSON body.
 *
 * @see {@link StorageLocation} for the response domain type.
 */
import { StorageLocationType } from './storage-location';

/**
 * Payload for `PATCH /storage-locations/web/{id}`. Every field is optional;
 * only the fields the caller wants to change need to be supplied. The
 * backend treats omitted fields as unchanged.
 */
export interface UpdateStorageLocationRequest {
  /** New display name. */
  locationName?: string;

  /** New classification. */
  locationType?: StorageLocationType;

  /** New address. */
  address?: string;

  /** New owning project ID. */
  projectId?: number;

  /**
   * Not sent. The name is a read-side flattening of the owning project,
   * echoed back on write; the association itself moves with
   * {@link projectId}, which is sent alongside and applies. Renaming a
   * project is a project operation, not a storage-location one.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  projectName?: string;

  /** New capacity in domain-specific units. */
  capacity?: number;

  /** New geographic latitude (decimal degrees). */
  latitude?: number;

  /** New geographic longitude (decimal degrees). */
  longitude?: number;

  /** New active flag. Sent as-is — `undefined` is forwarded as `undefined`. */
  active?: boolean;
}

/**
 * Serializes an {@link UpdateStorageLocationRequest} for the backend.
 *
 * Optional fields are sent as `null` rather than omitted so the backend's
 * deserializer sees an explicit value. The `active` flag, in contrast, is
 * forwarded verbatim so a deliberate `undefined` does not flip an existing
 * active record to inactive.
 *
 * `projectName` is deliberately left out. `StorageLocationUpdateDto`
 * carries the project as an id, and the name only ever came back on the
 * response.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updateStorageLocationToJson(
  dto: UpdateStorageLocationRequest
): Record<string, unknown> {
  return {
    locationName: dto.locationName,
    locationType: dto.locationType,
    address: dto.address ?? null,
    projectId: dto.projectId ?? null,
    capacity: dto.capacity ?? null,
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
    active: dto.active,
  };
}
