/**
 * @module low-stock-material
 *
 * Domain type and parser for a material the backend has found at or below
 * the reorder level in force.
 *
 * This is a different row from {@link Material}: the comparison is made on
 * the server, at the scope the caller asked about, so `currentStock` and
 * `reorderLevel` here are the two numbers that were actually compared. At
 * storage-location scope `reorderLevel` is the location's override when it
 * has one, which is a value no client-side comparison against the
 * material's global level can reproduce.
 */
import { z } from 'zod';
import {
  money,
  nullableNumber,
  nullableString,
  numericId,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

/**
 * Shape of the backend `LowStockMaterialDto` at the parse boundary.
 * `materialId` is a strict positive integer; the quantities coerce through
 * `money` because the backend serialises them as doubles and, on some
 * drivers, as strings.
 */
const LowStockMaterialResponseSchema = z.object({
  materialId: numericId,
  sku: nullableString,
  materialName: z.string(),
  unit: nullableString,
  currentStock: money,
  reorderLevel: money,
  shortfall: money,
  moq: nullableNumber,
  projectId: optionalNumericId,
  storageLocationId: optionalNumericId,
});

/**
 * A material whose stock has reached or fallen below the reorder level in
 * force at the scope that was asked about.
 */
export interface LowStockMaterial {
  /** Surrogate ID of the material. */
  materialId: number;

  /** Stock-keeping unit code, when the material carries one. */
  sku?: string;

  /** Display name of the material. */
  materialName: string;

  /** Unit of measure the quantities below are counted in. */
  unit: string;

  /**
   * Quantity on hand at the scope that was asked about. Zero when the
   * material holds nothing there at all.
   */
  currentStock: number;

  /**
   * The reorder level the backend applied. At storage-location scope this
   * is the location's override when it has one, and the material's own
   * level otherwise.
   */
  reorderLevel: number;

  /**
   * How far below the reorder level the stock is, never negative. Zero for
   * a material sitting exactly on its level.
   */
  shortfall: number;

  /** Minimum order quantity in force at that scope, when one is recorded. */
  moq?: number;

  /** Project the stock was counted within; absent for an organization total. */
  projectId?: number;

  /** Storage location the stock was counted at; absent unless one was asked about. */
  storageLocationId?: number;
}

/**
 * Parses a raw low-stock payload from the backend.
 *
 * The three quantities are required rather than optional: a row that
 * reached this list did so because the backend compared them, and a row
 * that arrived without them is a payload we cannot report a shortfall
 * from, so it fails the parse rather than defaulting to zero.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link LowStockMaterial}.
 * @throws {z.ZodError} When the payload does not match the expected shape.
 */
export function parseLowStockMaterial(json: unknown): LowStockMaterial {
  const raw = LowStockMaterialResponseSchema.parse(json);
  if (
    raw.currentStock === null ||
    raw.currentStock === undefined ||
    raw.reorderLevel === null ||
    raw.reorderLevel === undefined ||
    raw.shortfall === null ||
    raw.shortfall === undefined
  ) {
    throw new TypeError(
      'parseLowStockMaterial: currentStock, reorderLevel and shortfall are all required'
    );
  }
  return {
    materialId: raw.materialId,
    sku: raw.sku ?? undefined,
    materialName: raw.materialName,
    unit: raw.unit ?? '',
    currentStock: raw.currentStock,
    reorderLevel: raw.reorderLevel,
    shortfall: raw.shortfall,
    moq: raw.moq ?? undefined,
    projectId: raw.projectId ?? undefined,
    storageLocationId: raw.storageLocationId ?? undefined,
  };
}
