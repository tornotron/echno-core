/**
 * @module site-transfer-asset-option
 *
 * An asset a site transfer can send, as listed by
 * `GET /site-transfers/web/sendable-assets`: one the asset register places at
 * the sending project and storage location, and that is not already in
 * transit on another transfer.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { nullableString, opaque } from '../../lib/validation/backend-schema';

const SiteTransferAssetOptionResponseSchema = z.object({
  id: opaque,
  assetCode: nullableString,
  name: nullableString,
  type: nullableString,
  status: nullableString,
  assignedTo: nullableString,
});

/** An asset a transfer from a given sending store can carry on an asset line. */
export interface SiteTransferAssetOption {
  /** Surrogate ID of the asset, sent as `assetId` on an asset line. */
  id: number;

  /** The organization's own code for the asset, for example `AST-0021`. */
  assetCode: string | null;

  /** Display name of the asset. */
  name: string;

  /** Asset type, a kebab-case value such as `heavy-equipment`. */
  type: string | null;

  /** Lifecycle status, a kebab-case value such as `in-use`. */
  status: string | null;

  /** Name of the person the asset is assigned to. */
  assignedTo: string | null;
}

/**
 * Parses one entry of the sendable-assets list.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link SiteTransferAssetOption}.
 * @throws {TypeError} When `id` is missing or non-positive.
 */
export function parseSiteTransferAssetOption(
  json: unknown
): SiteTransferAssetOption {
  const raw = SiteTransferAssetOptionResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseSiteTransferAssetOption.id'),
    assetCode: raw.assetCode ?? null,
    name: raw.name ?? '',
    type: raw.type ?? null,
    status: raw.status ?? null,
    assignedTo: raw.assignedTo ?? null,
  };
}
