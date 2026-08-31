/**
 * @module material-update
 *
 * Request payload and serializer for updating an existing
 * {@link Material}. Every field is optional — only set fields are sent.
 */
import { MaterialStatus } from './enum';

/**
 * Patch payload for updating a {@link Material}. Field semantics mirror
 * {@link CreateMaterialRequest}; absent fields leave the corresponding
 * backend value unchanged.
 */
export interface UpdateMaterialRequest {
  /** Display name shown in listings and pickers. */
  materialName?: string;

  /** Unit of measure. */
  unit?: string;

  /** Stock-keeping unit code. */
  sku?: string;

  /** Free-form description. */
  description?: string;

  /** Harmonised System of Nomenclature code. */
  hsn?: string;

  /** Applicable GST rate as a percentage (e.g. `18.00`). */
  gstRate?: number | null;

  /**
   * Not sent. `MaterialUpdateDto` declares none of the four coordinates of the
   * opening balance, and the asymmetry with creation is deliberate rather than
   * an oversight: they position the single `OPENING_BALANCE` inventory
   * transaction the material is created with, not editable catalogue
   * attributes. Correcting an opening balance is a stock adjustment, which is
   * its own endpoint and its own audit trail. See echno-core#57.
   *
   * @deprecated The value is ignored. Adjust stock through the stock-adjustment
   * endpoint instead.
   */
  openingStock?: number | null;

  /**
   * Not sent. `MaterialUpdateDto` declares none of the four coordinates of the
   * opening balance, and the asymmetry with creation is deliberate rather than
   * an oversight: they position the single `OPENING_BALANCE` inventory
   * transaction the material is created with, not editable catalogue
   * attributes. Correcting an opening balance is a stock adjustment, which is
   * its own endpoint and its own audit trail. See echno-core#57.
   *
   * @deprecated The value is ignored. Adjust stock through the stock-adjustment
   * endpoint instead.
   */
  storageLocationId?: number | null;

  /**
   * Not sent. `MaterialUpdateDto` declares none of the four coordinates of the
   * opening balance, and the asymmetry with creation is deliberate rather than
   * an oversight: they position the single `OPENING_BALANCE` inventory
   * transaction the material is created with, not editable catalogue
   * attributes. Correcting an opening balance is a stock adjustment, which is
   * its own endpoint and its own audit trail. See echno-core#57.
   *
   * @deprecated The value is ignored. Adjust stock through the stock-adjustment
   * endpoint instead.
   */
  projectId?: number | null;

  /** Minimum order quantity for procurement. */
  moq?: number;

  /** Minimum stock threshold. */
  minStock?: number;

  /** Maximum stock cap. */
  maxStock?: number;

  /** Buffer stock kept beyond `minStock`. */
  safetyStock?: number;

  /** Threshold at which a reorder is triggered. */
  reorderLevel?: number;

  /**
   * Not sent. `MaterialUpdateDto` declares none of the four coordinates of the
   * opening balance, and the asymmetry with creation is deliberate rather than
   * an oversight: they position the single `OPENING_BALANCE` inventory
   * transaction the material is created with, not editable catalogue
   * attributes. Correcting an opening balance is a stock adjustment, which is
   * its own endpoint and its own audit trail. See echno-core#57.
   *
   * @deprecated The value is ignored. Adjust stock through the stock-adjustment
   * endpoint instead.
   *
   * The contract check hints that this means `unit`. It does not: `unit` is the
   * unit of measure and is a separate field that is still sent.
   */
  unitCost?: number;

  /**
   * Not applied. `Material` has no category column, `MaterialDto` has no
   * category field, and nothing in the backend names one at any layer.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  category?: string;

  /**
   * Not applied. There is no such column and no such field on the response,
   * so the classification a caller sends here cannot be read back.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  status?: MaterialStatus;

  /**
   * Not applied. Stock history is derived from the inventory transactions,
   * not stored on the material, and there is no column to put samples in.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  trend?: number[];

  /** Lead-time-to-consume (days). */
  ltc?: number;
}

/**
 * Serializes an {@link UpdateMaterialRequest} into the backend's expected
 * patch body. Fields the caller did not set are omitted so the backend
 * leaves their current values untouched.
 *
 * `category`, `status` and `trend` are not forwarded. `MaterialUpdateDto`
 * declares none of them, and `updateMaterial` is a bound-DTO update rather
 * than a map and switch, so a value sent for one reached no `if` block and
 * the request still answered 200.
 *
 * @param dto - The patch request to serialize.
 * @returns A plain object containing only the fields the caller set.
 */
export function updateMaterialToJson(
  dto: UpdateMaterialRequest
): Record<string, unknown> {
  return {
    ...(dto.materialName !== undefined && { materialName: dto.materialName }),
    ...(dto.unit !== undefined && { unit: dto.unit }),
    ...(dto.sku !== undefined && { sku: dto.sku }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.hsn !== undefined && { hsn: dto.hsn }),
    ...(dto.gstRate !== undefined && { gstRate: dto.gstRate }),
    ...(dto.moq !== undefined && { moq: dto.moq }),
    ...(dto.minStock !== undefined && { minStock: dto.minStock }),
    ...(dto.maxStock !== undefined && { maxStock: dto.maxStock }),
    ...(dto.safetyStock !== undefined && { safetyStock: dto.safetyStock }),
    ...(dto.reorderLevel !== undefined && { reorderLevel: dto.reorderLevel }),
    ...(dto.ltc !== undefined && { ltc: dto.ltc }),
  };
}
