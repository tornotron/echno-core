/**
 * @module document-reversal-keys
 *
 * TanStack Query key factory for the document-reversals domain.
 *
 * Key shapes:
 * - `['document-reversals']` — namespace root, invalidation prefix only.
 * - `['document-reversals', 'paginated', { pageNo, pageSize, status }]` —
 *   one page of requests, consumed by {@link useDocumentReversalsPaginated}.
 *   With `status: 'PENDING'` this is the approvals queue.
 * - `['document-reversals', 'detail', id]` — one request by id, consumed by
 *   {@link useDocumentReversal}.
 * - `['document-reversals', 'document', documentType, documentId]` — every
 *   request raised on one document, consumed by
 *   {@link useDocumentReversalsByDocument}.
 * - `['document-reversals', 'eligibility', documentType, documentId]` — the
 *   server's answer to whether the document can be reversed and by the
 *   caller, consumed by {@link useDocumentReversalEligibility}.
 *
 * Every decision changes what the document's page shows (its banner, its
 * badge, the request control), so the mutations invalidate the whole
 * namespace rather than patching one key.
 */
import type {
  DocumentReversalStatus,
  ReversibleDocumentType,
} from '../../types/document-reversals';

export const documentReversalKeys = {
  /** Invalidation prefix only. */
  all: ['document-reversals'] as const,

  /** One page of requests, optionally filtered to one status. */
  paginated: (pageNo: number, pageSize: number, status?: DocumentReversalStatus) =>
    [
      ...documentReversalKeys.all,
      'paginated',
      { pageNo, pageSize, status: status ?? null },
    ] as const,

  /** One request by id. */
  detail: (id: number) => [...documentReversalKeys.all, 'detail', id] as const,

  /** Every request raised on one document. */
  byDocument: (documentType: ReversibleDocumentType, documentId: number) =>
    [...documentReversalKeys.all, 'document', documentType, documentId] as const,

  /** Whether one document can be reversed, and by the caller. */
  eligibility: (documentType: ReversibleDocumentType, documentId: number) =>
    [
      ...documentReversalKeys.all,
      'eligibility',
      documentType,
      documentId,
    ] as const,
};
