/**
 * @module site-transfer-receive
 *
 * Request payload and serializer for recording what a receiving site actually
 * took delivery of (`POST /site-transfers/web/{id}/receive`).
 *
 * echno-backend#660 split a transfer that crosses a project boundary into a
 * two-step document. Creating it posts only the outbound leg; the receiving
 * project's stock does not move until somebody there says what turned up. This
 * payload is that statement.
 *
 * Two asymmetries are contract rather than accident, and a client that
 * flattens them gets the document wrong:
 *
 * - **A shortfall is accepted with no acknowledgement.** Eight arriving
 *   against ten sent asserts nothing false: the ledger holds an honest
 *   outbound leg for ten and an honest inbound leg for eight, and the gap is
 *   reported as {@link SiteTransferItem.inTransitQuantity}, an open variance a
 *   stock adjustment closes. Do not build a confirmation for it, and do not
 *   offer to write the difference off.
 * - **An over-receipt is refused** with a 400 naming the line and the figures,
 *   unless {@link ReceiveSiteTransferRequest.allowOverReceipt} is set. The
 *   document would otherwise assert stock the transfer never sent.
 *
 * There is no actor field, deliberately. Who confirmed the delivery comes from
 * the session, so a receipt is the caller's own statement and cannot be filed
 * under a colleague's name.
 */

/**
 * How much of one transfer line arrived.
 *
 * The line is named by its own id and not by its material, because a transfer
 * may carry the same material on more than one line and a receipt has to say
 * which of them it answers.
 */
export interface ReceiveSiteTransferLine {
  /** Id of the {@link SiteTransferItem} this quantity is against. */
  itemId: number;

  /**
   * Quantity that arrived, in the material's unit.
   *
   * Zero is a legitimate answer and is not the same as leaving the line out:
   * it says this line's material did not arrive on this delivery, writes the
   * line's received quantity so the transfer records that somebody looked, and
   * raises no movement.
   */
  receivedQuantity: number;
}

/**
 * What arrived at the receiving site against a transfer that is in transit.
 */
export interface ReceiveSiteTransferRequest {
  /**
   * When the delivery was taken, as an ISO 8601 local date-time.
   *
   * Optional; the server uses the moment the receipt is filed when it is left
   * out. It dates the inbound movements the receipt writes.
   */
  receivedOn?: string;

  /**
   * Set only when the delivery really did carry more than the transfer sent.
   *
   * Without it an over-receipt is refused, and the refusal names the line, the
   * quantity sent, what has already arrived and what this receipt adds, which
   * is enough to recognise a typed digit. Send it only on a second attempt, by
   * somebody who has read those figures and meant it: material standing in the
   * yard is there whether the system likes it or not, and a receipt that
   * cannot be filed leaves it outside the ledger.
   *
   * A short delivery needs no such flag. Setting this on one changes nothing.
   */
  allowOverReceipt?: boolean;

  /**
   * Optional note about the delivery, carried onto the inbound movements and
   * onto the transfer's status trail.
   */
  remarks?: string;

  /**
   * One entry per line being confirmed.
   *
   * Lines left out are untouched, so a lorry answering part of a transfer
   * names only the lines it answers. Must not be empty.
   */
  items: ReceiveSiteTransferLine[];
}

/**
 * Serializes a {@link ReceiveSiteTransferRequest} into the backend's expected
 * request body.
 *
 * Optional fields are omitted when `undefined` rather than sent as `undefined`,
 * so the server applies its own defaults. `allowOverReceipt` in particular is
 * omitted unless the caller named it, so a first attempt carries no
 * acknowledgement at all rather than an explicit `false`.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function receiveSiteTransferToJson(
  dto: ReceiveSiteTransferRequest
): Record<string, unknown> {
  return {
    ...(dto.receivedOn === undefined ? {} : { receivedOn: dto.receivedOn }),
    ...(dto.allowOverReceipt === undefined
      ? {}
      : { allowOverReceipt: dto.allowOverReceipt }),
    ...(dto.remarks === undefined ? {} : { remarks: dto.remarks }),
    items: dto.items.map((item) => ({
      itemId: item.itemId,
      receivedQuantity: item.receivedQuantity,
    })),
  };
}
