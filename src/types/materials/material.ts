/**
 * @module material
 *
 * Domain type and parser for the materials inventory entity.
 * {@link parseMaterial} normalises the backend's wire format into the
 * canonical {@link Material} shape; {@link parseMaterialWithStock}
 * specialises it for endpoints that always carry a numeric `currentStock`.
 */
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { Employee, parseEmployee } from '../employee';
import { MaterialStatus } from './enum';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * A single inventory item the organisation tracks stock for. Optional
 * stock-related fields (`currentStock`, `stockValue`, `openingStock`,
 * etc.) are populated when the backend resolves them against a storage
 * location; otherwise they are omitted.
 */
export interface Material {
  /** Surrogate primary key. */
  id: number;

  /** Stock-keeping unit code; unique within the organisation when set. */
  sku?: string;

  /** Display name shown in listings and pickers. */
  materialName: string;

  /** Unit of measure (e.g. `kg`, `m`, `nos`). */
  unit: string;

  /** Free-form description. */
  description?: string;

  /** Harmonised System of Nomenclature code (tax classification). */
  hsn?: string;

  /** Current on-hand quantity at the resolved storage location. */
  currentStock?: number;

  /** Monetary value of `currentStock` (currency determined by backend). */
  stockValue?: number;

  /** Stock level recorded when the material was first added. */
  openingStock?: number;

  /** Surrogate ID of the default {@link StorageLocation}. */
  storageLocationId?: number;

  /** Surrogate ID of the {@link Project} this material is allocated to. */
  projectId?: number;

  /** Minimum order quantity for procurement. */
  moq?: number;

  /** Minimum stock threshold — UI may highlight when crossed. */
  minStock?: number;

  /** Maximum stock cap — UI may warn when exceeded. */
  maxStock?: number;

  /** Buffer stock kept beyond `minStock` to absorb demand spikes. */
  safetyStock?: number;

  /** Threshold at which a reorder is triggered. */
  reorderLevel?: number;

  /** The {@link Employee} who created the material record. */
  createdBy?: Employee;

  /** Free-form category label (no dedicated enum on the backend). */
  category?: string;

  /** Stock-availability classification — see {@link MaterialStatus}. */
  status?: MaterialStatus;

  /** Recent stock-level samples for sparkline rendering. */
  trend?: number[];

  /** Lead-time-to-consume (days) used by reorder planning. */
  ltc?: number;
}

/**
 * Variant of {@link Material} returned by stock-aware endpoints. Narrows
 * `currentStock` from optional to required so consumers don't need to
 * null-check it.
 */
export interface MaterialWithStock extends Material {
  /** Current on-hand quantity; guaranteed present on this variant. */
  currentStock: number;
}

/**
 * Parses a raw material payload from the backend into a typed
 * {@link Material}. Optional scalar fields are coerced from
 * `null`/`undefined` to `undefined`; `trend` falls back to `undefined`
 * unless the payload supplies an array.
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link Material}.
 * @throws {TypeError} When `raw.id` is missing or non-positive
 *   (propagated from {@link parsePositiveInt}).
 */
export function parseMaterial(raw: Raw): Material {
  return {
    id: parsePositiveInt(raw.id, 'parseMaterial.id'),
    sku: raw.sku ?? undefined,
    materialName: raw.materialName,
    unit: raw.unit,
    description: raw.description ?? undefined,
    hsn: raw.hsn ?? undefined,
    currentStock: raw.currentStock ?? undefined,
    stockValue: raw.stockValue ?? undefined,
    openingStock: raw.openingStock ?? undefined,
    storageLocationId: raw.storageLocationId ?? undefined,
    projectId: raw.projectId ?? undefined,
    moq: raw.moq ?? undefined,
    minStock: raw.minStock ?? undefined,
    maxStock: raw.maxStock ?? undefined,
    safetyStock: raw.safetyStock ?? undefined,
    reorderLevel: raw.reorderLevel ?? undefined,
    createdBy: raw.createdBy ? parseEmployee(raw.createdBy) : undefined,
    category: raw.category ?? undefined,
    status: raw.status ?? undefined,
    trend: Array.isArray(raw.trend) ? (raw.trend as number[]) : undefined,
    ltc: raw.ltc ?? undefined,
  };
}

/**
 * Parses a raw payload from a stock-aware endpoint into a typed
 * {@link MaterialWithStock}. Defaults `currentStock` to `0` when the backend
 * omits it so the field stays non-optional for consumers.
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link MaterialWithStock}.
 * @throws {TypeError} When `raw.id` is missing or non-positive
 *   (propagated from {@link parsePositiveInt}).
 */
export function parseMaterialWithStock(raw: Raw): MaterialWithStock {
  return {
    ...parseMaterial(raw),
    currentStock: raw.currentStock ?? 0,
  };
}
