/**
 * @module indent-item
 *
 * Domain type and parser for a single line item on an {@link Indent}.
 * Line items carry the requested material, quantities, and a flag
 * indicating whether the line has been converted into a purchase order.
 */
import { parsePositiveInt } from "../../lib/utils/parse-id";
import { Material } from "../materials";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * A single line item on an {@link Indent}. The embedded
 * {@link Material} is shaped from either a nested `material` object or
 * the flat `materialId` / `materialName` / `unit` fields the backend
 * sometimes returns at the top level (the parser tolerates both).
 */
export interface IndentItem {
  /** Surrogate primary key. */
  id: number;

  /** The material being requested. Includes display fields for listings. */
  material: Material;

  /** Free-form spec text supplementing the material (e.g. grade, finish). */
  additionalSpecifications?: string;

  /** Quantity originally requested by the indent creator. */
  requestedQuantity: number;

  /** Quantity actually placed on a purchase order, when known. */
  orderedQuantity?: number;

  /** Free-form notes attached to the line item. */
  remarks?: string;

  /** `true` once the line has been included on a purchase order. */
  convertedToPurchaseOrder: boolean;

  /**
   * Human-readable PO number this line was converted into. Populated
   * once {@link useMarkIndentItemConverted} flips the line.
   */
  linkedPurchaseOrderNumber?: string;
}

/**
 * Parses a raw indent-item payload into a typed {@link IndentItem}.
 *
 * Tolerates two material shapes — a nested `material` object is preferred,
 * otherwise falls back to flat `materialId` / `materialName` / `unit`
 * fields. `convertedToPurchaseOrder` defaults to `false` when absent.
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link IndentItem}.
 * @throws {TypeError} When `raw.id` or the resolved material id is missing
 *   or non-positive (propagated from {@link parsePositiveInt}).
 */
export function parseIndentItem(raw: Raw): IndentItem {
  return {
    id: parsePositiveInt(raw.id, 'parseIndentItem.id'),
    material: {
      id: parsePositiveInt(
        raw.material?.id ?? raw.materialId,
        'parseIndentItem.material.id'
      ),
      sku: raw.material?.sku ?? undefined,
      materialName: raw.material?.materialName ?? raw.materialName ?? '',
      unit: raw.material?.unit ?? raw.unit ?? '',
    },
    additionalSpecifications: raw.additionalSpecifications ?? undefined,
    requestedQuantity: raw.requestedQuantity,
    orderedQuantity: raw.orderedQuantity ?? undefined,
    remarks: raw.remarks ?? undefined,
    convertedToPurchaseOrder: raw.convertedToPurchaseOrder ?? false,
    linkedPurchaseOrderNumber: raw.linkedPurchaseOrderNumber ?? undefined,
  };
}
