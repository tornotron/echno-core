/**
 * @module storage-location-stock
 *
 * Domain types and parser for a storage location's stock roll-up — the
 * totals a single location currently holds across every material it
 * stores, plus a per-material breakdown. Returned by
 * `GET /inventory-transactions/web/storage-location/{storageLocationId}/stock`.
 */

import { z } from 'zod';
import {
  money,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';

/**
 * Shape of the backend storage-location-stock payload at the parse boundary.
 * Numeric fields stay nullish so the parser's `?? 0` defaults still apply;
 * stock quantities and values coerce string BigDecimals through `money`.
 */
const LocationMaterialStockSchema = z.object({
  materialId: nullableNumber,
  materialName: nullableString,
  unit: nullableString,
  stock: money,
  stockValue: money,
});

const StorageLocationStockResponseSchema = z.object({
  storageLocationId: nullableNumber,
  storageLocationName: nullableString,
  projectId: nullableNumber,
  materialStock: z.array(LocationMaterialStockSchema).nullish(),
  totalStock: money,
  totalStockValue: money,
});

/**
 * Stock for one material at the parent storage location. Stock value
 * is computed server-side from the weighted average cost basis at the
 * time of the query.
 */
export interface LocationMaterialStock {
  /** Surrogate ID of the material. */
  materialId: number;

  /** Material display name. */
  materialName: string;

  /** Unit of measure for `stock` (e.g. `kg`, `nos`, `m`). */
  unit: string;

  /** Quantity on hand at the parent location, in `unit`. */
  stock: number;

  /** Monetary value of `stock` (computed server-side). */
  stockValue: number;
}

/**
 * Roll-up of one storage location's stock across every material it
 * currently holds. `totalStock` and `totalStockValue` sum the entries
 * in `materialStock`.
 */
export interface StorageLocationStock {
  /** Surrogate ID of the storage location. */
  storageLocationId: number;

  /** Storage-location display name. */
  storageLocationName: string;

  /** Surrogate ID of the project the location belongs to. */
  projectId: number;

  /** Per-material breakdown of stock and stock value. */
  materialStock: LocationMaterialStock[];

  /** Sum of `stock` across every entry in `materialStock`. */
  totalStock: number;

  /** Sum of `stockValue` across every entry in `materialStock`. */
  totalStockValue: number;
}

/**
 * Parses a raw storage-location-stock payload into a typed
 * {@link StorageLocationStock}.
 *
 * Numeric fields default to `0` and an absent or non-array `materialStock`
 * resolves to `[]`. A structurally invalid payload fails fast at the schema
 * boundary rather than flowing through as fabricated values.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link StorageLocationStock}.
 * @throws {Error} When the payload is not a structurally valid object.
 */
export function parseStorageLocationStock(json: unknown): StorageLocationStock {
  const raw = StorageLocationStockResponseSchema.parse(json);
  return {
    storageLocationId: raw.storageLocationId ?? 0,
    storageLocationName: raw.storageLocationName ?? '',
    projectId: raw.projectId ?? 0,
    materialStock: Array.isArray(raw.materialStock)
      ? raw.materialStock.map((ms) => ({
          materialId: ms.materialId ?? 0,
          materialName: ms.materialName ?? '',
          unit: ms.unit ?? '',
          stock: ms.stock ?? 0,
          stockValue: ms.stockValue ?? 0,
        }))
      : [],
    totalStock: raw.totalStock ?? 0,
    totalStockValue: raw.totalStockValue ?? 0,
  };
}
