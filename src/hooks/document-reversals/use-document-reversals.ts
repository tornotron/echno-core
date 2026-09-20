/**
 * @module use-document-reversals
 *
 * Query hooks for the document-reversals domain.
 */
import { useQuery } from '@tanstack/react-query';
import { documentReversalsService } from '../../services/document-reversals-service';
import type {
  DocumentReversalStatus,
  ReversibleDocumentType,
} from '../../types/document-reversals';
import { documentReversalKeys } from './keys';

/**
 * One page of reversal requests, most recently raised first. Pass
 * `DocumentReversalStatus.pending` for the approvals queue.
 */
export const useDocumentReversalsPaginated = (
  pageNo = 0,
  pageSize = 10,
  status?: DocumentReversalStatus
) =>
  useQuery({
    queryKey: documentReversalKeys.paginated(pageNo, pageSize, status),
    queryFn: () =>
      documentReversalsService.getAllPaginated(pageNo, pageSize, status),
  });

/** One reversal request by id. */
export const useDocumentReversal = (id: number) =>
  useQuery({
    queryKey: documentReversalKeys.detail(id),
    queryFn: () => documentReversalsService.getById(id),
    enabled: !!id,
  });

/**
 * Every request ever raised on one document, most recent first: the pending
 * one for the banner, the approved one that undid it for the badge's link,
 * the refusals before it for the history.
 */
export const useDocumentReversalsByDocument = (
  documentType: ReversibleDocumentType,
  documentId: number
) =>
  useQuery({
    queryKey: documentReversalKeys.byDocument(documentType, documentId),
    queryFn: () =>
      documentReversalsService.getByDocument(documentType, documentId),
    enabled: !!documentId,
  });

/**
 * Whether one document can be reversed right now, and whether the caller
 * may ask. What the detail page reads before showing "Request reversal".
 */
export const useDocumentReversalEligibility = (
  documentType: ReversibleDocumentType,
  documentId: number
) =>
  useQuery({
    queryKey: documentReversalKeys.eligibility(documentType, documentId),
    queryFn: () =>
      documentReversalsService.getEligibility(documentType, documentId),
    enabled: !!documentId,
  });
