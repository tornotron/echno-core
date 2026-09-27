/**
 * @module storage-location
 *
 * Domain type for a physical or logical storage location where inventory is
 * held — godowns, project sites, head office, warehouses, processing plants,
 * and miscellaneous locations.
 *
 * Exports the {@link StorageLocation} interface, the {@link StorageLocationType}
 * enum and its display-label map, and the {@link parseStorageLocation} parser
 * that converts a raw backend payload into a typed domain object.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  nullableBoolean,
  nullableNumber,
  nullableString,
  nullableStringOrNumber,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

/**
 * Classification of a storage location's physical role.
 *
 * Values are persisted as upper-snake-case strings to match the backend
 * enum; UI surfaces should render the {@link STORAGE_LOCATION_TYPE_LABELS}
 * map rather than the raw value.
 */
export enum StorageLocationType {
  /** General-purpose storage building, typically off-site. */
  GODOWN = 'GODOWN',

  /** Storage maintained at an active project site. */
  PROJECT_SITE = 'PROJECT_SITE',

  /** Storage co-located with the company head office. */
  HEAD_OFFICE = 'HEAD_OFFICE',

  /** Larger-scale warehouse facility. */
  WAREHOUSE = 'WAREHOUSE',

  /** Catch-all for locations that don't fit the other categories. */
  OTHERS = 'OTHERS',

  /** Processing plant where material is transformed before redistribution. */
  PROCESSING_PLANT = 'PROCESSING_PLANT',
}

/**
 * Human-readable labels for each {@link StorageLocationType}. Use this in
 * UI components instead of formatting the enum value directly so casing
 * and wording stay consistent across the app.
 */
export const STORAGE_LOCATION_TYPE_LABELS: Record<StorageLocationType, string> =
  {
    [StorageLocationType.GODOWN]: 'Godown',
    [StorageLocationType.PROJECT_SITE]: 'Project Site',
    [StorageLocationType.HEAD_OFFICE]: 'Head Office',
    [StorageLocationType.WAREHOUSE]: 'Warehouse',
    [StorageLocationType.OTHERS]: 'Others',
    [StorageLocationType.PROCESSING_PLANT]: 'Processing Plant',
  };

/**
 * Represents a single storage location.
 *
 * `StorageLocation` is a flat domain type — all fields are scalars and
 * there are no nested arrays. Direct `setQueryData` is safe; merge helpers
 * like `mergePreservingNested` are unnecessary.
 */
export interface StorageLocation {
  /** Unique surrogate identifier. */
  id: number;

  /** Display name of the location. */
  locationName: string;

  /** Classification of the location's role. */
  locationType: StorageLocationType;

  /** Free-form postal or descriptive address; absent if the backend stored none. */
  address?: string;

  /**
   * ID of the project this location belongs to, if any. Typically set when
   * {@link locationType} is {@link StorageLocationType.PROJECT_SITE}.
   */
  projectId?: number;

  /** Denormalized project name supplied by the backend for display convenience. */
  projectName?: string;

  /**
   * Storage capacity as the user wrote it, units included (for example
   * `"5000 sq ft"` or `"200 t"`). The backend keeps it as free text because
   * units vary by material, so it is for display only and is never summed or
   * compared as a number.
   */
  capacity?: string;

  /** Geographic latitude (decimal degrees). */
  latitude?: number;

  /** Geographic longitude (decimal degrees). */
  longitude?: number;

  /** Server-computed count of storage items currently held at this location. */
  storageItemsCount?: number;

  /** Whether the location is currently active for receiving inventory. */
  active: boolean;
}

const StorageLocationResponseSchema = z.object({
  id: opaque,
  locationName: nullableString,
  locationType: nullableString,
  address: nullableString,
  projectId: optionalNumericId,
  projectName: nullableString,
  capacity: nullableStringOrNumber,
  latitude: nullableNumber,
  longitude: nullableNumber,
  storageItemsCount: nullableNumber,
  active: nullableBoolean,
});

/**
 * Normalizes the free-text capacity. A number from an older payload is kept
 * as its text, and a blank string reads as no capacity.
 */
function parseCapacity(value: string | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

/**
 * Parses a raw API payload into a typed {@link StorageLocation}.
 *
 * Missing optional fields are coerced to `undefined`; `active` defaults to
 * `true` when absent. The `id` is validated as a positive integer via
 * {@link parsePositiveInt}.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `StorageLocation` domain object.
 * @throws {TypeError} If `id` is missing or not a positive integer.
 */
export function parseStorageLocation(json: unknown): StorageLocation {
  const raw = StorageLocationResponseSchema.parse(json);

  const id = parsePositiveInt(raw.id, 'parseStorageLocation.id');
  return {
    id,
    locationName: raw.locationName ?? '',
    locationType: raw.locationType as StorageLocationType,
    address: raw.address ?? undefined,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    capacity: parseCapacity(raw.capacity),
    latitude: raw.latitude ?? undefined,
    longitude: raw.longitude ?? undefined,
    storageItemsCount: raw.storageItemsCount ?? undefined,
    active: raw.active ?? true,
  };
}
