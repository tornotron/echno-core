/**
 * @module material-location-threshold
 *
 * Domain type, parser, and upsert serializer for per-storage-location
 * threshold overrides on a {@link Material}. A material carries default
 * thresholds (`minStock`, `maxStock`, etc.); a threshold override lets a
 * single storage location diverge from those defaults. Absence of an
 * override means the location falls back to the material's defaults.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  nullableNumber,
  nullableString,
  numericId,
  opaque,
} from '../../lib/validation/backend-schema';

/**
 * Shape of the backend threshold payload at the parse boundary. `id`,
 * `materialId`, and `storageLocationId` stay strict positive integers;
 * every threshold quantity is a nullable number.
 */
const MaterialLocationThresholdResponseSchema = z.object({
  id: opaque,
  materialId: numericId,
  storageLocationId: numericId,
  storageLocationName: nullableString,
  minStock: nullableNumber,
  maxStock: nullableNumber,
  safetyStock: nullableNumber,
  reorderLevel: nullableNumber,
  moq: nullableNumber,
});

/**
 * A per-storage-location override of a {@link Material}'s stock thresholds.
 * Each threshold field is optional: an absent value means the location
 * inherits the material-level default for that threshold rather than
 * setting an override of `0`.
 */
export interface MaterialLocationThreshold {
  /** Surrogate primary key of the override row. */
  id: number;

  /** Surrogate ID of the {@link Material} this override belongs to. */
  materialId: number;

  /** Surrogate ID of the storage location the override applies to. */
  storageLocationId: number;

  /** Denormalized storage-location name supplied for display convenience. */
  storageLocationName: string;

  /** Minimum stock threshold at this location. */
  minStock?: number;

  /** Maximum stock cap at this location. */
  maxStock?: number;

  /** Buffer stock kept beyond `minStock` at this location. */
  safetyStock?: number;

  /** Threshold at which a reorder is triggered at this location. */
  reorderLevel?: number;

  /** Minimum order quantity for procurement at this location. */
  moq?: number;
}

/**
 * Upsert payload for a per-location threshold override. Every field is an
 * optional nullable number: omit a field to leave it unchanged on update,
 * or send `null` to clear the override and fall back to the material
 * default.
 */
export interface MaterialLocationThresholdUpsert {
  /** Minimum stock threshold at this location. */
  minStock?: number | null;

  /** Maximum stock cap at this location. */
  maxStock?: number | null;

  /** Buffer stock kept beyond `minStock` at this location. */
  safetyStock?: number | null;

  /** Threshold at which a reorder is triggered at this location. */
  reorderLevel?: number | null;

  /** Minimum order quantity for procurement at this location. */
  moq?: number | null;
}

/**
 * Parses a raw threshold payload from the backend into a typed
 * {@link MaterialLocationThreshold}. Optional threshold quantities are
 * coerced from `null`/`undefined` to `undefined`.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link MaterialLocationThreshold}.
 * @throws {TypeError} When `raw.id` is missing or non-positive
 *   (propagated from {@link parsePositiveInt}).
 */
export function parseMaterialLocationThreshold(
  json: unknown
): MaterialLocationThreshold {
  const raw = MaterialLocationThresholdResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseMaterialLocationThreshold.id'),
    materialId: raw.materialId,
    storageLocationId: raw.storageLocationId,
    storageLocationName: raw.storageLocationName ?? '',
    minStock: raw.minStock ?? undefined,
    maxStock: raw.maxStock ?? undefined,
    safetyStock: raw.safetyStock ?? undefined,
    reorderLevel: raw.reorderLevel ?? undefined,
    moq: raw.moq ?? undefined,
  };
}

/**
 * Serializes a {@link MaterialLocationThresholdUpsert} into the backend's
 * expected request body. Only fields the caller explicitly set are
 * included, so an unset field is omitted rather than sent as `undefined`;
 * an explicit `null` is preserved so the backend can clear the override.
 *
 * @param dto - The upsert request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function materialLocationThresholdToJson(
  dto: MaterialLocationThresholdUpsert
): Record<string, unknown> {
  return {
    ...(dto.minStock !== undefined && { minStock: dto.minStock }),
    ...(dto.maxStock !== undefined && { maxStock: dto.maxStock }),
    ...(dto.safetyStock !== undefined && { safetyStock: dto.safetyStock }),
    ...(dto.reorderLevel !== undefined && { reorderLevel: dto.reorderLevel }),
    ...(dto.moq !== undefined && { moq: dto.moq }),
  };
}
