/**
 * @module material-movement-history
 *
 * Domain type and parser for one entry of a material's movement
 * history. The backend serves this as a dedicated, server-ordered
 * timeline (`/inventory-transactions/web/material/{id}/history`),
 * distinct from the full ledger entry returned by the plain
 * `/material/{id}` listing: it carries only the fields a timeline
 * needs (where, when, which direction, how much) and arrives ordered
 * oldest movement first.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import type { InventoryTransactionType } from './enums';
import {
  money,
  nullableString,
  opaque,
  numericId,
} from '../../lib/validation/backend-schema';

/**
 * Direction a movement type moves stock in. Mirrors the backend
 * `InventoryTransactionType.StockEffect`.
 */
export enum StockDirection {
  /** The movement type always adds stock (GRN, transfer-in, gain, …). */
  increase = 'INCREASE',

  /** The movement type always removes stock (usage, scrap, transfer-out, …). */
  decrease = 'DECREASE',

  /** The sign comes from the signed quantity, not from the type (adjustments). */
  either = 'EITHER',
}

/**
 * Shape of the backend movement-history payload at the parse boundary.
 * Ids stay `opaque` (validated by `parsePositiveInt`); `transactionType`
 * and `direction` are cast to their domain enums by the parser.
 */
const MaterialMovementHistoryEntryResponseSchema = z.object({
  id: opaque,
  transactionDate: z.string(),
  transactionType: opaque,
  direction: opaque,
  storageLocationId: numericId,
  storageLocationName: nullableString,
  projectId: numericId,
  projectName: nullableString,
  openingStock: money,
  quantityChanged: money,
  closingStock: money,
  referenceNumber: nullableString,
  createdByName: nullableString,
});

/**
 * A single movement in a material's history, condensed for a timeline.
 *
 * Narrower than {@link InventoryTransaction}: it answers where the
 * material was, when, in what direction, by how much, what the stock
 * level was either side of the movement and who booked it, and leaves
 * out the cost basis, remarks and task link the full ledger entry
 * carries. Entries arrive ordered oldest first.
 */
export interface MaterialMovementHistoryEntry {
  /** Surrogate ID of the underlying ledger entry. */
  id: number;

  /** ISO 8601 timestamp the movement was recorded. */
  transactionDate: string;

  /** Classification of the movement — see {@link InventoryTransactionType}. */
  transactionType: InventoryTransactionType;

  /**
   * Direction the movement type moves stock in, sourced from the type
   * server-side. `either` means the sign comes from
   * {@link MaterialMovementHistoryEntry.quantityChanged}.
   */
  direction: StockDirection;

  /** Surrogate ID of the storage location the movement applied to. */
  storageLocationId: number;

  /** Storage-location display name (denormalised from `storageLocationId`). */
  storageLocationName: string;

  /** Surrogate ID of the project the movement is booked against. */
  projectId: number;

  /** Project display name (denormalised from `projectId`). */
  projectName: string;

  /** Stock level at the location immediately before this movement. */
  openingStock: number;

  /** Signed change applied by this movement. Positive in, negative out. */
  quantityChanged: number;

  /** Stock level at the location immediately after this movement. */
  closingStock: number;

  /**
   * Source document reference for the movement (a GRN or challan
   * number, for example). Absent for ad-hoc adjustments.
   */
  referenceNumber?: string;

  /**
   * Display name of the employee who booked the movement. For automated
   * movements this is the actor who triggered the source event.
   * `undefined` when the ledger row records no creator.
   */
  createdByName?: string;
}

/**
 * Parses a raw movement-history payload into a typed
 * {@link MaterialMovementHistoryEntry}.
 *
 * The stock figures fall back to `0` when absent; a missing
 * `direction` falls back to {@link StockDirection.either} so the caller
 * derives the sign from the quantity rather than guessing a direction.
 * `createdByName` stays `undefined` for a movement with no recorded
 * creator, which the backend leaves null.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link MaterialMovementHistoryEntry}.
 * @throws {TypeError} When `raw.id` is missing or non-positive
 *   (propagated from {@link parsePositiveInt}).
 */
export function parseMaterialMovementHistoryEntry(
  json: unknown
): MaterialMovementHistoryEntry {
  const raw = MaterialMovementHistoryEntryResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseMaterialMovementHistoryEntry.id'),
    transactionDate: raw.transactionDate,
    transactionType: raw.transactionType as InventoryTransactionType,
    direction: (raw.direction as StockDirection) ?? StockDirection.either,
    storageLocationId: raw.storageLocationId,
    storageLocationName: raw.storageLocationName ?? '',
    projectId: raw.projectId,
    projectName: raw.projectName ?? '',
    openingStock: raw.openingStock ?? 0,
    quantityChanged: raw.quantityChanged ?? 0,
    closingStock: raw.closingStock ?? 0,
    referenceNumber: raw.referenceNumber ?? undefined,
    createdByName: raw.createdByName ?? undefined,
  };
}
