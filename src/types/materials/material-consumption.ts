/**
 * @module material-consumption
 *
 * Domain type and parser for a {@link Material} consumption event — a
 * record that a quantity of a material was used from stock or transferred
 * out of a storage location.
 */
import { parsePositiveInt } from '../../lib/utils/parse-id';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Mechanism by which a material left inventory.
 */
export enum ConsumptionType {
  /** Material was used from stock (e.g. installed on a task / project). */
  usedFromStock = 'USED_FROM_STOCK',

  /** Material was transferred between storage locations or out of stock. */
  transferred = 'TRANSFERRED',
}

/**
 * Human-readable label for each {@link ConsumptionType} value. Use this
 * when rendering the enum in the UI; the enum itself stays the API of
 * record.
 */
export const consumptionTypeLabels: Record<ConsumptionType, string> = {
  [ConsumptionType.usedFromStock]: 'Used from Stock',
  [ConsumptionType.transferred]: 'Transferred',
};

/**
 * A single consumption event against a {@link Material}. Carries
 * denormalised display fields (`materialName`, `projectName`,
 * `storageLocationName`, `taskTitle`) so listings render without joining
 * each related entity.
 */
export interface MaterialConsumption {
  /** Surrogate primary key. */
  id: number;

  /** ISO 8601 date the consumption took place. */
  consumptionDate: string;

  /** Surrogate ID of the consumed {@link Material}. */
  materialId: number;

  /** Display name of the consumed material (denormalised from `materialId`). */
  materialName: string;

  /** Quantity consumed, measured in the material's `unit`. */
  quantity: number;

  /** Mechanism of consumption — see {@link ConsumptionType}. */
  consumptionType: ConsumptionType;

  /** Free-form notes attached to the consumption event. */
  details?: string;

  /** Surrogate ID of the project the consumption is allocated to. */
  projectId?: number;

  /** Display name of the project (denormalised from `projectId`). */
  projectName?: string;

  /** Surrogate ID of the storage location stock was drawn from. */
  storageLocationId?: number;

  /** Display name of the storage location (denormalised). */
  storageLocationName?: string;

  /** Surrogate ID of the task the consumption is allocated to. */
  taskId?: number;

  /** Display title of the task (denormalised from `taskId`). */
  taskTitle?: string;

  /** Employee who recorded the consumption — minimal `{ id, name }` shape. */
  createdBy: { id: number; name: string };
}

/**
 * Parses a raw consumption payload into a typed {@link MaterialConsumption}.
 *
 * Unknown `consumptionType` values default to
 * {@link ConsumptionType.usedFromStock} so an unexpected backend value
 * doesn't break list rendering.
 *
 * `createdBy.name` is sourced from `employeeName` first and falls back to
 * `name`, mirroring how the backend serialises the actor in some
 * envelopes.
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link MaterialConsumption}.
 * @throws {TypeError} When `raw.id` or `raw.createdBy.id` is missing or
 *   non-positive (propagated from {@link parsePositiveInt}).
 */
export function parseMaterialConsumption(raw: Raw): MaterialConsumption {
  return {
    id: parsePositiveInt(raw.id, 'parseMaterialConsumption.id'),
    consumptionDate: raw.consumptionDate,
    materialId: raw.materialId,
    materialName: raw.materialName,
    quantity: raw.quantity,
    consumptionType: Object.values(ConsumptionType).includes(
      raw.consumptionType
    )
      ? (raw.consumptionType as ConsumptionType)
      : ConsumptionType.usedFromStock,
    details: raw.details ?? undefined,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    storageLocationId: raw.storageLocationId ?? undefined,
    storageLocationName: raw.storageLocationName ?? undefined,
    taskId: raw.taskId ?? undefined,
    taskTitle: raw.taskTitle ?? undefined,
    createdBy: {
      id: parsePositiveInt(
        raw.createdBy?.id,
        'parseMaterialConsumption.createdBy.id'
      ),
      name: raw.createdBy?.employeeName ?? raw.createdBy?.name ?? '',
    },
  };
}
