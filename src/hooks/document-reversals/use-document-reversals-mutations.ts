/**
 * @module use-document-reversals-mutations
 *
 * Mutation hooks for the document-reversals domain.
 *
 * Cache strategy. A decision changes three things at once: the request
 * itself, what the document's page shows (badge, banner, request control)
 * and, on approval, the document's status, its `reversalId`, the stock
 * balances of every affected store and the ledger. None of that can be
 * replayed from the one response, so every mutation invalidates the whole
 * reversal namespace, the three document namespaces, the material stock
 * caches and the ledger. The response is written into the detail cache so
 * a page already open on the request refreshes without a round trip.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { documentReversalsService } from '../../services/document-reversals-service';
import { documentReversalKeys } from './keys';
import type {
  CreateDocumentReversalRequest,
  DocumentReversal,
  RejectDocumentReversalRequest,
} from '../../types/document-reversals';
import { logger } from '../../lib/logger';
import { siteTransferKeys } from '../site-transfers/keys';
import { poKeys } from '../purchase-orders/purchase-order-keys';
import { grnKeys } from '../grn/keys';
import { materialsKeys } from '../materials/keys';
import { inventoryTransactionKeys } from '../inventory-transactions/keys';

function settle(queryClient: QueryClient, reversal: DocumentReversal, movedStock: boolean) {
  queryClient.setQueryData<DocumentReversal>(
    documentReversalKeys.detail(reversal.id),
    reversal
  );
  queryClient.invalidateQueries({ queryKey: documentReversalKeys.all });
  // The document's own caches carry its status and reversalId.
  queryClient.invalidateQueries({ queryKey: siteTransferKeys.all });
  queryClient.invalidateQueries({ queryKey: poKeys.all });
  queryClient.invalidateQueries({ queryKey: grnKeys.all });
  if (movedStock) {
    queryClient.invalidateQueries({ queryKey: materialsKeys.all });
    queryClient.invalidateQueries({ queryKey: inventoryTransactionKeys.all });
  }
}

/** Raises a reversal request on a document the caller created. */
export const useRequestDocumentReversal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDocumentReversalRequest) =>
      documentReversalsService.request(dto),
    onSuccess: (reversal) => settle(queryClient, reversal, false),
    onError: (error) => logger.error('Failed to request document reversal:', error),
  });
};

/** Approves a pending request: the document is undone and the stores are told. */
export const useApproveDocumentReversal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => documentReversalsService.approve(id),
    onSuccess: (reversal) => settle(queryClient, reversal, true),
    onError: (error) => logger.error('Failed to approve document reversal:', error),
  });
};

/** Rejects a pending request with a reason. Nothing moves. */
export const useRejectDocumentReversal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: RejectDocumentReversalRequest }) =>
      documentReversalsService.reject(id, dto),
    onSuccess: (reversal) => settle(queryClient, reversal, false),
    onError: (error) => logger.error('Failed to reject document reversal:', error),
  });
};

/** Withdraws the caller's own pending request. */
export const useCancelDocumentReversal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => documentReversalsService.cancel(id),
    onSuccess: (reversal) => settle(queryClient, reversal, false),
    onError: (error) => logger.error('Failed to cancel document reversal:', error),
  });
};
