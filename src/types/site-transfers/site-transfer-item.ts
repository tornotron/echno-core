/**
 * @module site-transfer-item
 *
 * Domain types, request DTO, and parsers/serializers for a single line
 * item on a {@link SiteTransfer}. The "create" shape is what gets
 * embedded under {@link CreateSiteTransferRequest.items}; the
 * server-resolved shape is what comes back as part of `SiteTransfer.items`.
 *
 * A line carries either a material or an asset, told apart by
 * {@link SiteTransferItem.lineType}. A material line names a material and a
 * quantity; an asset line names one asset from the asset register and always
 * sends one unit.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  money,
  nullableString,
  optionalNumericId,
  opaque,
} from '../../lib/validation/backend-schema';
import { SiteTransferLineType } from './enums';

/**
 * Shape of the backend site-transfer line-item payload at the parse boundary.
 * `id` stays `opaque` (validated by `parsePositiveInt`); `sentQuantity` and
 * `transferValue` coerce string BigDecimals through `money`.
 */
const SiteTransferItemResponseSchema = z.object({
  id: opaque,
  lineType: nullableString,
  materialId: optionalNumericId,
  materialName: nullableString,
  assetId: optionalNumericId,
  assetCode: nullableString,
  assetName: nullableString,
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

  /**
   * Whether the line carries a material or an asset. A payload from a server
   * that predates asset lines reads as {@link SiteTransferLineType.material},
   * which is the only kind it could hold.
   */
  lineType: SiteTransferLineType;

  /** Surrogate ID of the {@link Material} being transferred. `null` on an asset line. */
  materialId: number | null;

  /** Material display name (denormalised from `materialId`). `null` on an asset line. */
  materialName: string | null;

  /** Surrogate ID of the asset being transferred. `null` on a material line. */
  assetId: number | null;

  /** The organization's own code for the asset, for example `AST-0021`. `null` on a material line. */
  assetCode: string | null;

  /** Asset display name. `null` on a material line. */
  assetName: string | null;

  /**
   * Quantity dispatched from the sending location, in the material's unit.
   * Always `1` on an asset line.
   */
  sentQuantity: number;

  /**
   * Quantity recorded as having arrived at the receiving site.
   *
   * `null` while nobody has confirmed anything about this line, which is not
   * the same as confirming that nothing came: a line received as zero holds
   * `0` and says somebody looked. Render the two differently, or a transfer
   * nobody has touched reads as a delivery that turned up empty.
   *
   * On an asset line this is `1` once the asset has arrived, and the asset's
   * project and location have moved with it.
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
   * On an asset line, `1` means the asset is still in transit.
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
 * A material line to create, embedded under
 * {@link CreateSiteTransferRequest.items}. The server assigns `id` and
 * computes `transferValue`; `materialName` is resolved server-side from
 * `materialId`.
 */
export interface CreateMaterialTransferLineRequest {
  /**
   * {@link SiteTransferLineType.material}, or left out: a line that names no
   * type is a material line, which is what every line was before asset lines.
   */
  lineType?: SiteTransferLineType.material;

  /** Surrogate ID of the {@link Material} being transferred. */
  materialId: number;

  /** Quantity to dispatch from the sending location, in the material's unit. */
  sentQuantity: number;

  /** Free-form notes to attach to the line item. */
  remarks?: string;
}

/**
 * An asset line to create. The asset must be at the transfer's sending
 * project and storage location and not already in transit on another
 * transfer; `useSendableAssets` lists exactly those. One asset per line.
 */
export interface CreateAssetTransferLineRequest {
  lineType: SiteTransferLineType.asset;

  /** Surrogate ID of the asset being transferred. */
  assetId: number;

  /** Free-form notes to attach to the line item. */
  remarks?: string;
}

/**
 * Inputs required to create a single site-transfer line item, embedded under
 * {@link CreateSiteTransferRequest.items}: a material line or an asset line.
 * Narrow on `lineType` to tell them apart.
 */
export type CreateSiteTransferItemRequest =
  | CreateMaterialTransferLineRequest
  | CreateAssetTransferLineRequest;

/** Whether a line to create moves an asset rather than a material. */
export function isAssetTransferLineRequest(
  line: CreateSiteTransferItemRequest
): line is CreateAssetTransferLineRequest {
  return line.lineType === SiteTransferLineType.asset;
}

/**
 * Serializes a {@link CreateSiteTransferItemRequest} into the backend's
 * expected request body.
 *
 * An asset line always goes out with `sentQuantity: 1`, because the server
 * refuses any other figure for one: an asset is one machine. A material line
 * goes out as it always has, with no `lineType`, which the server reads as a
 * material line.
 *
 * @param dto - The line-item request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createSiteTransferItemToJson(
  dto: CreateSiteTransferItemRequest
): Record<string, unknown> {
  if (isAssetTransferLineRequest(dto)) {
    return {
      lineType: SiteTransferLineType.asset,
      assetId: dto.assetId,
      sentQuantity: 1,
      remarks: dto.remarks,
    };
  }
  return {
    materialId: dto.materialId,
    sentQuantity: dto.sentQuantity,
    remarks: dto.remarks,
  };
}

/** Reads the wire value of a line type, treating anything unknown as a material line. */
function parseLineType(value: string | null | undefined): SiteTransferLineType {
  return value === SiteTransferLineType.asset
    ? SiteTransferLineType.asset
    : SiteTransferLineType.material;
}

/**
 * Parses a raw site-transfer line-item payload into a typed
 * {@link SiteTransferItem}.
 *
 * Numeric fields fall back to safe defaults (`0`) when absent; optional
 * fields resolve to `undefined`. `receivedQuantity` is the exception: it
 * stays `null` when absent, because "nobody has confirmed this line" is a
 * distinct statement from "nothing arrived". The material and asset
 * references are `null` on the kind of line that does not carry them.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link SiteTransferItem}.
 * @throws {TypeError} When `raw.id` is missing or non-positive
 *   (propagated from {@link parsePositiveInt}).
 */
export function parseSiteTransferItem(json: unknown): SiteTransferItem {
  const raw = SiteTransferItemResponseSchema.parse(json);
  const id = parsePositiveInt(raw.id, 'parseSiteTransferItem.id');
  const lineType = parseLineType(raw.lineType);
  const isAsset = lineType === SiteTransferLineType.asset;
  return {
    id,
    lineType,
    materialId: isAsset ? null : (raw.materialId ?? null),
    materialName: isAsset ? null : (raw.materialName ?? ''),
    assetId: isAsset ? (raw.assetId ?? null) : null,
    assetCode: isAsset ? (raw.assetCode ?? null) : null,
    assetName: isAsset ? (raw.assetName ?? '') : null,
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
