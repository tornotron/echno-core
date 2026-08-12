/**
 * @module grn-item
 *
 * Domain type and parser for a single line item on a
 * {@link GoodsReceivedNote}. Each line records the material received,
 * the originally ordered quantity, the quantity actually received, and
 * the per-unit cost (where the backend has a cost basis).
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  money,
  nullableString,
  numericId,
  opaque,
} from '../../lib/validation/backend-schema';

const GrnItemResponseSchema = z.object({
  id: opaque,
  materialId: numericId,
  materialName: nullableString,
  orderedQuantity: money,
  receivedQuantity: money,
  unitCost: money,
});

/**
 * A single line item on a {@link GoodsReceivedNote}. `materialName` is
 * denormalised from `materialId` for display.
 */
export interface GrnItem {
  /** Surrogate primary key. */
  id: number;

  /** Surrogate ID of the {@link Material} being received. */
  materialId: number;

  /** Material display name (denormalised from `materialId`). */
  materialName: string;

  /**
   * Quantity originally ordered on the source purchase order line, in
   * the material's unit. Echoed from the PO at receipt time.
   */
  orderedQuantity: number;

  /** Quantity actually received against this line, in the material's unit. */
  receivedQuantity: number;

  /**
   * Per-unit cost recorded against this line. Absent when the server
   * has no cost basis (e.g. receipts against POs without unit pricing).
   */
  unitCost?: number;
}

/**
 * Parses a raw GRN line-item payload into a typed {@link GrnItem}.
 * `materialName` defaults to `''` when absent; `unitCost` falls back to
 * `undefined`.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link GrnItem}.
 * @throws {TypeError} When `id` is missing or non-positive (propagated from
 *   {@link parsePositiveInt}), or `materialId` is not a positive integer.
 */
export function parseGrnItem(json: unknown): GrnItem {
  const raw = GrnItemResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseGrnItem.id'),
    materialId: raw.materialId,
    materialName: raw.materialName ?? '',
    orderedQuantity: raw.orderedQuantity ?? 0,
    receivedQuantity: raw.receivedQuantity ?? 0,
    unitCost: raw.unitCost ?? undefined,
  };
}
