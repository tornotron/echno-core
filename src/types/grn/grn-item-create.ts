/**
 * @module grn-item-create
 *
 * Request payload for a single line item embedded in a
 * {@link CreateGrnRequest}. Items are always created inline as part of
 * the parent GRN — there is no standalone endpoint for creating GRN
 * line items.
 */

/**
 * Inputs required to create a single GRN line item, embedded under
 * {@link CreateGrnRequest.items}.
 */
export interface CreateGrnItemRequest {
  /** Surrogate ID of the {@link Material} being received. */
  materialId: number;

  /**
   * Quantity ordered on the source PO line, in the material's unit.
   * Echoed onto the new GRN line at receipt time.
   */
  orderedQuantity: number;

  /** Quantity actually received, in the material's unit. */
  receivedQuantity: number;

  /**
   * Per-unit cost to record against this line. Omit if the server
   * should compute the cost basis (e.g. from the linked PO line).
   */
  unitCost?: number;
}
