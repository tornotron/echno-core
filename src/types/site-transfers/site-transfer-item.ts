/**
 * @module site-transfer-item
 *
 * Domain types, request DTO, and parsers/serializers for a single line
 * item on a {@link SiteTransfer}. The "create" shape is what gets
 * embedded under {@link CreateSiteTransferRequest.items}; the
 * server-resolved shape is what comes back as part of `SiteTransfer.items`.
 */
import { parsePositiveInt } from "../../lib/utils/parse-id";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

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
 * absent; optional fields resolve to `undefined`.
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link SiteTransferItem}.
 * @throws {TypeError} When `raw.id` is missing or non-positive
 *   (propagated from {@link parsePositiveInt}).
 */
export function parseSiteTransferItem(raw: Raw): SiteTransferItem {
  const id = parsePositiveInt(raw.id, 'parseSiteTransferItem.id');
  return {
    id,
    materialId: raw.materialId ?? 0,
    materialName: raw.materialName ?? '',
    sentQuantity: raw.sentQuantity ?? 0,
    transferValue: raw.transferValue ?? undefined,
    remarks: raw.remarks ?? undefined,
  };
}
