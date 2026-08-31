/**
 * @module material-create
 *
 * Request payload and serializer for creating a new {@link Material}.
 */
import { MaterialStatus } from './enum';

/**
 * Inputs required to create a new {@link Material}. Optional numeric
 * fields accept `null` where the backend treats `null` distinctly from
 * "omit" (e.g. unset an opening stock vs. never tracked).
 */
export interface CreateMaterialRequest {
  /** Display name shown in listings and pickers. */
  materialName: string;

  /** Unit of measure (e.g. `kg`, `m`, `nos`). */
  unit: string;

  /** Surrogate ID of the {@link Employee} creating the record. */
  createdBy: number;

  /** Stock-keeping unit code; unique within the organisation when set. */
  sku?: string;

  /** Free-form description. */
  description?: string;

  /** Harmonised System of Nomenclature code. */
  hsn?: string;

  /** Applicable GST rate as a percentage (e.g. `18.00`). */
  gstRate?: number | null;

  /** Initial on-hand quantity at creation time. */
  openingStock?: number | null;

  /** Surrogate ID of the default storage location. */
  storageLocationId?: number | null;

  /** Surrogate ID of an associated project. */
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

  /** Cost per `unit` at creation time. */
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
 * Serializes a {@link CreateMaterialRequest} into the backend's expected
 * request body. Only fields the caller explicitly set are included, so an
 * unset optional field is omitted from the payload rather than sent as
 * `null` or `undefined`.
 *
 * `category`, `status` and `trend` are not forwarded. `MaterialCreationDto`
 * declares none of them and neither does the entity, so they were read off no
 * field and dropped, and the response could never carry them back.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createMaterialToJson(
  dto: CreateMaterialRequest
): Record<string, unknown> {
  return {
    materialName: dto.materialName,
    unit: dto.unit,
    createdBy: dto.createdBy,
    ...(dto.sku !== undefined && { sku: dto.sku }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.hsn !== undefined && { hsn: dto.hsn }),
    ...(dto.gstRate !== undefined && { gstRate: dto.gstRate }),
    ...(dto.openingStock !== undefined && { openingStock: dto.openingStock }),
    ...(dto.storageLocationId !== undefined && {
      storageLocationId: dto.storageLocationId,
    }),
    ...(dto.projectId !== undefined && { projectId: dto.projectId }),
    ...(dto.moq !== undefined && { moq: dto.moq }),
    ...(dto.minStock !== undefined && { minStock: dto.minStock }),
    ...(dto.maxStock !== undefined && { maxStock: dto.maxStock }),
    ...(dto.safetyStock !== undefined && { safetyStock: dto.safetyStock }),
    ...(dto.reorderLevel !== undefined && { reorderLevel: dto.reorderLevel }),
    ...(dto.unitCost !== undefined && { unitCost: dto.unitCost }),
    ...(dto.ltc !== undefined && { ltc: dto.ltc }),
  };
}
