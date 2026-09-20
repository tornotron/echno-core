/**
 * @module document-reversal-eligibility
 *
 * Whether one document can be reversed right now, and by the caller
 * (`GET /document-reversals/web/eligibility`).
 *
 * The detail screens read this before showing the request control, so the
 * answer comes from the same checks the write path applies rather than from
 * a copy of them in the browser.
 */
import { z } from 'zod';
import {
  nullableBoolean,
  nullableString,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

const DocumentReversalEligibilityResponseSchema = z.object({
  reversible: nullableBoolean,
  blocker: nullableString,
  callerIsCreator: nullableBoolean,
  pendingReversalId: optionalNumericId,
  reversalId: optionalNumericId,
});

/**
 * The server's answer to "can this document be reversed, and may I ask".
 */
export interface DocumentReversalEligibility {
  /** True when nothing stands in the way of a request being raised. */
  reversible: boolean;

  /**
   * What stands in the way when `reversible` is false: the downstream
   * document, the consumed stock, the document's state, or a pending request.
   * The same message the request would be refused with.
   */
  blocker?: string;

  /** True when the caller raised the document and so may request its reversal. */
  callerIsCreator: boolean;

  /** Id of the pending request on this document, if there is one. */
  pendingReversalId?: number;

  /** Id of the approved reversal that undid this document, if it has been reversed. */
  reversalId?: number;
}

/**
 * Parses a raw eligibility payload into a typed
 * {@link DocumentReversalEligibility}. Absent booleans read as false, which
 * is the safe direction for a control that unlocks a write.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed eligibility.
 */
export function parseDocumentReversalEligibility(
  json: unknown
): DocumentReversalEligibility {
  const raw = DocumentReversalEligibilityResponseSchema.parse(json);
  return {
    reversible: raw.reversible ?? false,
    blocker: raw.blocker ?? undefined,
    callerIsCreator: raw.callerIsCreator ?? false,
    pendingReversalId: raw.pendingReversalId ?? undefined,
    reversalId: raw.reversalId ?? undefined,
  };
}
