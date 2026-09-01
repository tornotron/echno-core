/**
 * @module site-transfer-item
 *
 * Domain types, request DTO, and parsers/serializers for a single line
 * item on a {@link SiteTransfer}. The "create" shape is what gets
 * embedded under {@link CreateSiteTransferRequest.items}; the
 * server-resolved shape is what comes back as part of `SiteTransfer.items`.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  money,
  nullableString,
  optionalNumericId,
  opaque,
} from '../../lib/validation/backend-schema';

/**
 * Shape of the backend site-transfer line-item payload at the parse boundary.
 * `id` stays `opaque` (validated by `parsePositiveInt`); `sentQuantity` and
 * `transferValue` coerce string BigDecimals through `money`.
 */
const SiteTransferItemResponseSchema = z.object({
  id: opaque,
  materialId: optionalNumericId,
  materialName: nullableString,
  sentQuantity: money,
  receivedQuantity: money,
  inTransitQuantity: money,
  transferValue: money,
  remarks: nullableString,
});

/**
 * A single line item on a {@link SiteTransfer}, as returned by the
 * server. `materialName` is denormalised from `materialId` for
 * display; `transferValue` is the monetary value of the moved stock,
 * computed server-side.
 */
export interface SiteTransferItem {
  /** Surrogate primary key. */
  id: number;

  /** Surrogate ID of the {@link Material} being transferred. */
  materialId: number;

  /** Material display name (denormalised from `materialId`). */
  materialName: string;

  /** Quantity dispatched from the sending location, in the material's unit. */
  sentQuantity: number;

  /**
   * Quantity recorded as having arrived at the receiving site.
   *
   * `null` while nobody has confirmed anything about this line, which is not
   * the same as confirming that nothing came: a line received as zero holds
   * `0` and says somebody looked. Render the two differently, or a transfer
   * nobody has touched reads as a delivery that turned up empty.
   *
   * Read-only. It is written by `POST /site-transfers/web/{id}/receive` and
   * never by a payload of the client's own.
   */
  receivedQuantity: number | null;

  /**
   * Sent minus received: what is neither at the sending site nor recorded as
   * having reached the receiving one.
   *
   * On a {@link SiteTransferStatus.pending} transfer this is stock on a lorry.
   * On a received one it is an **open variance** — the sending site is down
   * the full sent quantity, the receiving site is up what arrived, and the
   * difference is unaccounted for. The transfer writes no loss movement for
   * it, deliberately: a loss written automatically is a stock correction
   * nobody authorised. Show it as an open figure with a route to raise a stock
   * adjustment naming the transfer; do not offer to write it off.
   *
   * Read-only, and the whole sent quantity while nothing has been confirmed.
   */
  inTransitQuantity: number;

  /**
   * Monetary value of `sentQuantity` at the time of dispatch,
   * computed server-side. Absent when the backend has no cost basis.
   */
  transferValue?: number;

  /** Free-form notes attached to the line item. */
  remarks?: string;
}

/**
 * Inputs required to create a single site-transfer line item, embedded
 * under {@link CreateSiteTransferRequest.items}. The server assigns
 * `id` and computes `transferValue`; `materialName` is resolved
 * server-side from `materialId`.
 */
export interface CreateSiteTransferItemRequest {
  /** Surrogate ID of the {@link Material} being transferred. */
  materialId: number;

  /** Quantity to dispatch from the sending location, in the material's unit. */
  sentQuantity: number;

  /** Free-form notes to attach to the line item. */
  remarks?: string;
}

/**
 * Serializes a {@link CreateSiteTransferItemRequest} into the
 * backend's expected request body. All fields are forwarded verbatim —
 * the backend tolerates `undefined` on optional fields.
 *
 * @param dto - The line-item request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createSiteTransferItemToJson(
  dto: CreateSiteTransferItemRequest
): Record<string, unknown> {
  return {
    materialId: dto.materialId,
    sentQuantity: dto.sentQuantity,
    remarks: dto.remarks,
  };
}

/**
 * Parses a raw site-transfer line-item payload into a typed
 * {@link SiteTransferItem}.
 *
 * Numeric/string fields fall back to safe defaults (`0` / `''`) when
 * absent; optional fields resolve to `undefined`. `receivedQuantity` is the
 * exception: it stays `null` when absent, because "nobody has confirmed this
 * line" is a distinct statement from "nothing arrived".
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link SiteTransferItem}.
 * @throws {TypeError} When `raw.id` is missing or non-positive
 *   (propagated from {@link parsePositiveInt}).
 */
export function parseSiteTransferItem(json: unknown): SiteTransferItem {
  const raw = SiteTransferItemResponseSchema.parse(json);
  const id = parsePositiveInt(raw.id, 'parseSiteTransferItem.id');
  return {
    id,
    materialId: raw.materialId ?? 0,
    materialName: raw.materialName ?? '',
    sentQuantity: raw.sentQuantity ?? 0,
    // Kept as null rather than folded to 0: an unconfirmed line and a line
    // confirmed as receiving nothing are different statements, and only the
    // absence of the field distinguishes them.
    receivedQuantity: raw.receivedQuantity ?? null,
    // Falls back to the arithmetic rather than to 0, so a payload from a
    // server that predates the field still reports a pending line's stock as
    // in transit instead of claiming nothing is.
    inTransitQuantity:
      raw.inTransitQuantity ??
      Math.max((raw.sentQuantity ?? 0) - (raw.receivedQuantity ?? 0), 0),
    transferValue: raw.transferValue ?? undefined,
    remarks: raw.remarks ?? undefined,
  };
}
