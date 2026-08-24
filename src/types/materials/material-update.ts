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

  /** Opening stock baseline. */
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

  /** Cost per `unit`. */
  unitCost?: number;

  /** Free-form category label. */
  category?: string;

  /** Stock-availability classification — see {@link MaterialStatus}. */
  status?: MaterialStatus;

  /** Recent stock-level samples for sparkline rendering. */
  trend?: number[];

  /** Lead-time-to-consume (days). */
  ltc?: number;
}

/**
 * Serializes an {@link UpdateMaterialRequest} into the backend's expected
 * patch body. Fields the caller did not set are omitted so the backend
 * leaves their current values untouched.
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
    ...(dto.category !== undefined && { category: dto.category }),
    ...(dto.status !== undefined && { status: dto.status }),
    ...(dto.trend !== undefined && { trend: dto.trend }),
    ...(dto.ltc !== undefined && { ltc: dto.ltc }),
  };
}
