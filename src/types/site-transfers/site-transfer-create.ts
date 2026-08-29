/**
 * @module site-transfer-create
 *
 * Request payload and serializer for creating a new
 * {@link SiteTransfer}. Line items are embedded inline via
 * {@link CreateSiteTransferItemRequest}; the server creates the
 * parent transfer and its items in one round-trip and decrements
 * sending-location stock as a side-effect.
 */
import { SiteTransferStatus } from './enums';
import type { CreateSiteTransferItemRequest } from './site-transfer-item';
import { createSiteTransferItemToJson } from './site-transfer-item';

/**
 * Inputs required to create a new {@link SiteTransfer} together with
 * its line items.
 */
export interface CreateSiteTransferRequest {
  /** Human-readable transfer number; must be unique within the organisation. */
  transferNumber: string;

  /** ISO 8601 date the transfer is being dispatched. */
  issueDate: string;

  /** Surrogate ID of the {@link Employee} dispatching the transfer. */
  sendingPerson: number;

  /** Surrogate ID of the sending project. */
  sendingProjectId: number;

  /** Surrogate ID of the sending storage location. */
  sendingStorageLocationId: number;

  /** Surrogate ID of the receiving project. */
  receivingProjectId: number;

  /** Surrogate ID of the receiving storage location. */
  receivingStorageLocationId: number;

  /**
   * Initial lifecycle state. `POST /site-transfers/web` accepts
   * {@link SiteTransferStatus.pending} and nothing else, and defaults to
   * it when the payload names none, so this is optional and there is no
   * second value to choose from.
   *
   * {@link SiteTransferStatus.partiallyTransferred} and
   * {@link SiteTransferStatus.completed} are refused with a 400: both say
   * the receiving site has taken delivery, which is recorded through
   * `PATCH /site-transfers/web/{id}/status` by a different authority. Stock
   * leaves the sending location on creation whatever the status is given,
   * so a transfer issued as `COMPLETED` stood as a movement nobody at the
   * far end had confirmed. Reach the later states through
   * {@link useUpdateSiteTransferStatus}, which still takes the full enum.
   */
  status?: SiteTransferStatus.pending;

  /** Line items to create alongside the transfer. */
  items: CreateSiteTransferItemRequest[];
}

/**
 * Serializes a {@link CreateSiteTransferRequest} into the backend's
 * expected request body. Items are serialized via
 * {@link createSiteTransferItemToJson}.
 *
 * `status` is omitted from the body when the caller names none, rather
 * than sent as `undefined`, so the server applies its own `PENDING`
 * default.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createSiteTransferToJson(
  dto: CreateSiteTransferRequest
): Record<string, unknown> {
  return {
    transferNumber: dto.transferNumber,
    issueDate: dto.issueDate,
    sendingPerson: dto.sendingPerson,
    sendingProjectId: dto.sendingProjectId,
    sendingStorageLocationId: dto.sendingStorageLocationId,
    receivingProjectId: dto.receivingProjectId,
    receivingStorageLocationId: dto.receivingStorageLocationId,
    ...(dto.status === undefined ? {} : { status: dto.status }),
    items: dto.items.map((item) => createSiteTransferItemToJson(item)),
  };
}
