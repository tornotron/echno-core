/**
 * @module material-stock
 *
 * Domain types and parser for a material's stock roll-up — the totals
 * a material currently has across every storage location, plus a
 * per-location breakdown. Returned by
 * `GET /inventory-transactions/web/material/{materialId}/stock`.
 */

import { z } from 'zod';
import {
  money,
  nullableString,
  numericId,
} from '../../lib/validation/backend-schema';

/**
 * Shape of the backend material-stock payload at the parse boundary. Surrogate
 * ids are validated as positive integers; stock quantities and values coerce
 * string BigDecimals through `money`.
 */
const LocationStockSchema = z.object({
  storageLocationId: numericId,
  storageLocationName: nullableString,
  projectId: numericId,
  projectName: nullableString,
  stock: money,
  stockValue: money,
});

const MaterialStockResponseSchema = z.object({
  materialId: numericId,
  materialName: nullableString,
  locationStock: z.array(LocationStockSchema).nullish(),
  totalStock: money,
  totalStockValue: money,
});

/**
 * Stock the material currently holds at one storage location, scoped
 * to one project. Stock value is computed server-side from the
 * weighted average cost basis at the time of the query.
 */
export interface LocationStock {
  /** Surrogate ID of the storage location. */
  storageLocationId: number;

  /** Storage-location display name. */
  storageLocationName: string;

  /** Surrogate ID of the project the stock is allocated to. */
  projectId: number;

  /** Project display name. */
  projectName: string;

  /** Quantity on hand at this location, in the material's unit. */
  stock: number;

  /** Monetary value of `stock` (computed server-side). */
  stockValue: number;
}

/**
 * Roll-up of a single material's stock across every storage location.
 * `totalStock` and `totalStockValue` sum the entries in `locationStock`.
 */
export interface MaterialStock {
  /** Surrogate ID of the material. */
  materialId: number;

  /** Material display name. */
  materialName: string;

  /** Per-location breakdown of stock and stock value. */
  locationStock: LocationStock[];

  /** Sum of `stock` across every entry in `locationStock`. */
  totalStock: number;

  /** Sum of `stockValue` across every entry in `locationStock`. */
  totalStockValue: number;
}

/**
 * Parses a raw material-stock payload into a typed
 * {@link MaterialStock}.
 *
 * Numeric fields fall back to `0` when absent. An absent or non-array
 * `locationStock` resolves to `[]`.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link MaterialStock}.
 * @throws {Error} When the payload is not a structurally valid object.
 */
export function parseMaterialStock(json: unknown): MaterialStock {
  const raw = MaterialStockResponseSchema.parse(json);
  return {
    materialId: Number(raw.materialId),
    materialName: raw.materialName ?? '',
    locationStock: Array.isArray(raw.locationStock)
      ? raw.locationStock.map((ls) => ({
          storageLocationId: Number(ls.storageLocationId),
          storageLocationName: ls.storageLocationName ?? '',
          projectId: Number(ls.projectId),
          projectName: ls.projectName ?? '',
          stock: Number(ls.stock ?? 0),
          stockValue: Number(ls.stockValue ?? 0),
        }))
      : [],
    totalStock: Number(raw.totalStock ?? 0),
    totalStockValue: Number(raw.totalStockValue ?? 0),
  };
}
