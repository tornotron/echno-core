/**
 * @module storage-location-stock
 *
 * Domain types and parser for a storage location's stock roll-up — the
 * totals a single location currently holds across every material it
 * stores, plus a per-material breakdown. Returned by
 * `GET /inventory-transactions/web/storage-location/{storageLocationId}/stock`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

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
 * Tolerant of malformed inputs — any non-object `raw` is treated as
 * empty, numeric fields default to `0`, and an absent or non-array
 * `materialStock` resolves to `[]`. Never throws.
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link StorageLocationStock}.
 */
export function parseStorageLocationStock(raw: Raw): StorageLocationStock {
  const safeRaw = raw != null && typeof raw === 'object' ? raw : {};
  return {
    storageLocationId: safeRaw.storageLocationId ?? 0,
    storageLocationName: safeRaw.storageLocationName ?? '',
    projectId: safeRaw.projectId ?? 0,
    materialStock: Array.isArray(safeRaw.materialStock)
      ? safeRaw.materialStock.map((ms: Raw) => {
          const safeMs = ms != null && typeof ms === 'object' ? ms : {};
          return {
            materialId: safeMs.materialId ?? 0,
            materialName: safeMs.materialName ?? '',
            unit: safeMs.unit ?? '',
            stock: safeMs.stock ?? 0,
            stockValue: safeMs.stockValue ?? 0,
          };
        })
      : [],
    totalStock: safeRaw.totalStock ?? 0,
    totalStockValue: safeRaw.totalStockValue ?? 0,
  };
}
