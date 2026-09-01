/**
 * @module site-transfer-cancel
 *
 * Request payload and serializer for abandoning a transfer that never arrived
 * (`POST /site-transfers/web/{id}/cancel`).
 *
 * Cancelling returns the whole sent quantity to the sending project and
 * location it was drawn from, which is a real movement on the ledger. Without
 * it a transfer written off in transit would leave the sending project
 * permanently short with no way back, which is why the reason is required and
 * is kept on the transfer's status trail beside the movement it caused.
 *
 * Only a {@link SiteTransferStatus.pending} transfer can be cancelled. Once
 * anything has been received, part of the material is standing at the far site
 * and what to do about the rest is a decision for a stock adjustment rather
 * than a reversal.
 */

/**
 * Why a transfer that never arrived is being abandoned.
 */
export interface CancelSiteTransferRequest {
  /**
   * Why the transfer is being cancelled. Required, non-blank, and at most 500
   * characters — the server refuses an empty one, because the reversal is a
   * stock movement and a movement with no stated cause is unreadable six
   * months on.
   */
  reason: string;
}

/**
 * Serializes a {@link CancelSiteTransferRequest} into the backend's expected
 * request body.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function cancelSiteTransferToJson(
  dto: CancelSiteTransferRequest
): Record<string, unknown> {
  return { reason: dto.reason };
}
