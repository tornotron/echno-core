/**
 * @module document-reversal-request
 *
 * Request payloads and serializers for raising and rejecting a reversal.
 */
import { ReversibleDocumentType } from './enums';

/**
 * Asks for a document to be reversed (`POST /document-reversals/web`).
 *
 * The requester is taken from the session, never from the body: the server
 * refuses anyone but the document's creator. The reason is required and at
 * most 500 characters; the record of why a posted document was undone is
 * what separates a reversal from a deletion.
 */
export interface CreateDocumentReversalRequest {
  /** The kind of document to reverse. */
  documentType: ReversibleDocumentType;

  /** Id of that document. */
  documentId: number;

  /** Why it should be reversed. Required, non-blank, at most 500 characters. */
  reason: string;
}

/**
 * Serializes a {@link CreateDocumentReversalRequest} into the backend's
 * expected request body.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createDocumentReversalToJson(
  dto: CreateDocumentReversalRequest
): Record<string, unknown> {
  return {
    documentType: dto.documentType,
    documentId: dto.documentId,
    reason: dto.reason,
  };
}

/**
 * Why an approver refused a reversal (`POST /document-reversals/web/{id}/reject`).
 * Required, non-blank, at most 500 characters.
 */
export interface RejectDocumentReversalRequest {
  /** Why the reversal is being refused. */
  reason: string;
}

/**
 * Serializes a {@link RejectDocumentReversalRequest} into the backend's
 * expected request body.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function rejectDocumentReversalToJson(
  dto: RejectDocumentReversalRequest
): Record<string, unknown> {
  return { reason: dto.reason };
}
