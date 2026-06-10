/**
 * @module inventory-transaction
 *
 * Domain type and parser for an inventory transaction — a single
 * append-only ledger entry recording a stock movement at a storage
 * location. Transactions are written automatically by backend events
 * (GRN, consumption, site transfer, stock-take, …); the frontend reads
 * them but never creates or mutates them.
 */
import { parsePositiveInt } from '../../lib/utils/parse-id';
import type { InventoryTransactionType } from './enums';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * A single stock-movement ledger entry. Carries denormalised display
 * fields (`materialName`, `projectName`, `storageLocationName`,
 * `createdBy.name`) so listings render without joining each related
 * entity. `openingStock` / `closingStock` snapshot the location's stock
 * level immediately before and after this entry committed.
 */
export interface InventoryTransaction {
  /** Surrogate primary key. */
  id: number;

  /** ISO 8601 timestamp the underlying event committed server-side. */
  transactionDate: string;

  /** Surrogate ID of the {@link Material} the movement applies to. */
  materialId: number;

  /** Material display name (denormalised from `materialId`). */
  materialName: string;

  /** Stock level at the location immediately before this entry. */
  openingStock: number;

  /**
   * Signed delta applied by this entry. Positive for inbound movements
   * (GRN, transfer-in, gain, …); negative for outbound movements
   * (consume, scrap, transfer-out, …).
   */
  quantityChanged: number;

  /** Stock level at the location immediately after this entry. */
  closingStock: number;

  /** Classification of the entry — see {@link InventoryTransactionType}. */
  transactionType: InventoryTransactionType;

  /**
   * Free-form reference number from the originating event (e.g. GRN
   * number, transfer note number). Absent for ad-hoc adjustments.
   */
  referenceNumber?: string;

  /** Free-form notes attached to the entry. */
  remarks?: string;

  /** Surrogate ID of the project the stock belongs to. */
  projectId: number;

  /** Project display name (denormalised from `projectId`). */
  projectName: string;

  /** Surrogate ID of the storage location the movement applies to. */
  storageLocationId: number;

  /**
   * Storage-location display name (denormalised from
   * `storageLocationId`).
   */
  storageLocationName: string;

  /**
   * Per-unit cost recorded against this movement. `null` when the
   * server has no cost basis for the entry (e.g. some adjustment types).
   */
  unitCost: number | null;

  /**
   * Employee who booked the entry. For automated entries this is the
   * actor who triggered the source event. The backend returns the
   * display name under `createdBy.employeeName`; the parser maps it to
   * `name`.
   */
  createdBy: { id: number; name: string };
}

/**
 * Parses a raw inventory-transaction payload into a typed
 * {@link InventoryTransaction}.
 *
 * Numeric stock fields fall back to `0` when absent. `unitCost` falls
 * back to `null` (distinct from `0`) to preserve "no cost basis" as a
 * separate state from "zero cost".
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link InventoryTransaction}.
 * @throws {TypeError} When `raw.id` or `raw.createdBy.id` is missing or
 *   non-positive (propagated from {@link parsePositiveInt}).
 */
export function parseInventoryTransaction(raw: Raw): InventoryTransaction {
  return {
    id: parsePositiveInt(raw.id, 'parseInventoryTransaction.id'),
    transactionDate: raw.transactionDate,
    materialId: raw.materialId,
    materialName: raw.materialName ?? '',
    openingStock: raw.openingStock ?? 0,
    quantityChanged: raw.quantityChanged ?? 0,
    closingStock: raw.closingStock ?? 0,
    transactionType: raw.transactionType as InventoryTransactionType,
    referenceNumber: raw.referenceNumber ?? undefined,
    remarks: raw.remarks ?? undefined,
    projectId: raw.projectId,
    projectName: raw.projectName ?? '',
    storageLocationId: raw.storageLocationId,
    storageLocationName: raw.storageLocationName ?? '',
    unitCost: raw.unitCost ?? null,
    createdBy: {
      id: parsePositiveInt(
        raw.createdBy?.id,
        'parseInventoryTransaction.createdBy.id'
      ),
      name: raw.createdBy?.employeeName ?? '',
    },
  };
}
