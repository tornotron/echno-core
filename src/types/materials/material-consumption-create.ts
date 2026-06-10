/**
 * @module material-consumption-create
 *
 * Request payload and serializer for recording a new
 * {@link MaterialConsumption} event.
 */
import { ConsumptionType } from './material-consumption';

/**
 * Inputs required to record a new {@link MaterialConsumption}.
 */
export interface CreateMaterialConsumptionRequest {
  /** ISO 8601 date the consumption took place. */
  consumptionDate: string;

  /** Surrogate ID of the consumed {@link Material}. */
  materialId: number;

  /** Quantity consumed, measured in the material's `unit`. */
  quantity: number;

  /** Mechanism of consumption — see {@link ConsumptionType}. */
  consumptionType: ConsumptionType;

  /** Surrogate ID of the {@link Employee} recording the consumption. */
  createdBy: number;

  /** Free-form notes attached to the event. */
  details?: string;

  /** Surrogate ID of the project to allocate the consumption to. */
  projectId?: number;

  /** Surrogate ID of the storage location stock is drawn from. */
  storageLocationId?: number;

  /** Surrogate ID of the task the consumption is allocated to. */
  taskId?: number;
}

/**
 * Serializes a {@link CreateMaterialConsumptionRequest} into the
 * backend's expected request body. Only fields the caller explicitly set
 * are included.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createMaterialConsumptionToJson(
  dto: CreateMaterialConsumptionRequest
): Record<string, unknown> {
  return {
    consumptionDate: dto.consumptionDate,
    materialId: dto.materialId,
    quantity: dto.quantity,
    consumptionType: dto.consumptionType,
    createdBy: dto.createdBy,
    ...(dto.details !== undefined && { details: dto.details }),
    ...(dto.projectId !== undefined && { projectId: dto.projectId }),
    ...(dto.storageLocationId !== undefined && {
      storageLocationId: dto.storageLocationId,
    }),
    ...(dto.taskId !== undefined && { taskId: dto.taskId }),
  };
}
