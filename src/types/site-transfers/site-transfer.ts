/**
 * @module site-transfer
 *
 * Domain type and parser for a site transfer — a movement of stock
 * between two storage locations (typically across projects). Carries
 * one or more {@link SiteTransferItem} lines.
 *
 * Posting a transfer (`POST /site-transfers/web`) decrements stock at
 * the sending location server-side. A subsequent status transition to
 * {@link SiteTransferStatus.completed} acknowledges receipt at the
 * destination and increments destination stock accordingly. Each side-
 * effect writes its own inventory-transaction ledger entries.
 *
 * The parser normalises the backend's wire format into the canonical
 * {@link SiteTransfer} shape and tolerates two `sendingPerson` field
 * names (`employeeName` vs `name`) for backwards compatibility.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { SiteTransferStatus } from './enums';
import type { SiteTransferItem } from './site-transfer-item';
import { parseSiteTransferItem } from './site-transfer-item';
import {
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

/**
 * Shape of the backend site-transfer payload at the parse boundary. `id` and
 * `sendingPerson.id` stay `opaque` (validated by `parsePositiveInt`); `status`
 * is cast to the domain enum; `items` are handed to `parseSiteTransferItem`.
 */
const SiteTransferResponseSchema = z.object({
  id: opaque,
  transferNumber: z.string(),
  issueDate: z.string(),
  sendingPerson: z
    .object({ id: opaque, employeeName: nullableString, name: nullableString })
    .nullish(),
  sendingProjectId: optionalNumericId,
  sendingProjectName: nullableString,
  sendingStorageLocationId: optionalNumericId,
  sendingStorageLocationName: nullableString,
  receivingProjectId: optionalNumericId,
  receivingProjectName: nullableString,
  receivingStorageLocationId: optionalNumericId,
  receivingStorageLocationName: nullableString,
  status: opaque,
  items: z.array(z.unknown()).nullish(),
});

/**
 * A stock-movement order between two storage locations. Carries
 * denormalised display fields (sending/receiving project names and
 * storage-location names, `sendingPerson.name`) so listings render
 * without joining each related entity.
 */
export interface SiteTransfer {
  /** Surrogate primary key. */
  id: number;

  /** Human-readable transfer number assigned at creation. */
  transferNumber: string;

  /** ISO 8601 date the transfer was dispatched from the sending location. */
  issueDate: string;

  /**
   * Employee who dispatched the transfer. The backend returns the
   * display name under `sendingPerson.employeeName` (or
   * `sendingPerson.name` on legacy payloads); the parser maps either
   * to `name`.
   */
  sendingPerson: { id: number; name: string };

  /** Surrogate ID of the sending project. */
  sendingProjectId?: number;

  /** Sending-project display name (denormalised from `sendingProjectId`). */
  sendingProjectName?: string;

  /** Surrogate ID of the sending storage location. */
  sendingStorageLocationId?: number;

  /** Sending-location display name (denormalised from `sendingStorageLocationId`). */
  sendingStorageLocationName?: string;

  /** Surrogate ID of the receiving project. */
  receivingProjectId?: number;

  /** Receiving-project display name (denormalised from `receivingProjectId`). */
  receivingProjectName?: string;

  /** Surrogate ID of the receiving storage location. */
  receivingStorageLocationId?: number;

  /** Receiving-location display name (denormalised from `receivingStorageLocationId`). */
  receivingStorageLocationName?: string;

  /** Lifecycle state — see {@link SiteTransferStatus}. */
  status: SiteTransferStatus;

  /** Line items moved by this transfer. */
  items: SiteTransferItem[];
}

/**
 * Parses a raw site-transfer payload into a typed {@link SiteTransfer}.
 *
 * An unknown `status` value falls back to
 * {@link SiteTransferStatus.pending} so an unexpected backend value
 * doesn't break list rendering. Optional fields resolve to
 * `undefined`; an absent or non-array `items` resolves to `[]`.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link SiteTransfer}.
 * @throws {TypeError} When `raw.id` or `raw.sendingPerson.id` is
 *   missing or non-positive (propagated from {@link parsePositiveInt}).
 */
export function parseSiteTransfer(json: unknown): SiteTransfer {
  const raw = SiteTransferResponseSchema.parse(json);
  const id = parsePositiveInt(raw.id, 'parseSiteTransfer.id');
  return {
    id,
    transferNumber: raw.transferNumber,
    issueDate: raw.issueDate,
    sendingPerson: {
      id: parsePositiveInt(
        raw.sendingPerson?.id,
        'parseSiteTransfer.sendingPerson.id'
      ),
      name: raw.sendingPerson?.employeeName ?? raw.sendingPerson?.name ?? '',
    },
    sendingProjectId: raw.sendingProjectId ?? undefined,
    sendingProjectName: raw.sendingProjectName ?? undefined,
    sendingStorageLocationId: raw.sendingStorageLocationId ?? undefined,
    sendingStorageLocationName: raw.sendingStorageLocationName ?? undefined,
    receivingProjectId: raw.receivingProjectId ?? undefined,
    receivingProjectName: raw.receivingProjectName ?? undefined,
    receivingStorageLocationId: raw.receivingStorageLocationId ?? undefined,
    receivingStorageLocationName: raw.receivingStorageLocationName ?? undefined,
    status: Object.values(SiteTransferStatus).includes(
      raw.status as SiteTransferStatus
    )
      ? (raw.status as SiteTransferStatus)
      : SiteTransferStatus.pending,
    items: Array.isArray(raw.items)
      ? raw.items.map((item) => parseSiteTransferItem(item))
      : [],
  };
}

export { type CreateSiteTransferItemRequest } from './site-transfer-item';
