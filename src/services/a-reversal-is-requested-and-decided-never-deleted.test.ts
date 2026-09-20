/**
 * The reversal service puts the right verbs on the right routes: a request
 * is a POST with the document named in the body and the requester left to
 * the session, the two decisions are POSTs on the request's own path, and
 * nothing here is a DELETE. The reason travels on a rejection and on a
 * request; an approval carries no body.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { documentReversalsService } from './document-reversals-service';
import {
  DocumentReversalStatus,
  ReversibleDocumentType,
} from '../types/document-reversals/enums';

afterEach(() => {
  (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

const reversalDto = {
  id: 5,
  organizationId: 1,
  documentType: 'SITE_TRANSFER',
  documentId: 31,
  documentNumber: 'ST-2026-0031',
  status: 'PENDING',
  reason: 'Issued against the wrong store',
  requestedBy: 7,
  requestedByName: 'Ravi',
  requestedAt: '2026-09-20T10:15:00',
};

describe('documentReversalsService', () => {
  test('request posts the document and the reason, and nothing about who is asking', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(reversalDto);

    const r = await documentReversalsService.request({
      documentType: ReversibleDocumentType.siteTransfer,
      documentId: 31,
      reason: 'Issued against the wrong store',
    });

    expect(post).toHaveBeenCalledWith('/document-reversals/web', {
      documentType: 'SITE_TRANSFER',
      documentId: 31,
      reason: 'Issued against the wrong store',
    });
    expect(r.status).toBe(DocumentReversalStatus.pending);
    expect(r.documentNumber).toBe('ST-2026-0031');
  });

  test('approve is a bare POST on the request', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({
      ...reversalDto,
      status: 'APPROVED',
      reversalReference: 'REV-ST-2026-0031',
    });

    const r = await documentReversalsService.approve(5);

    expect(post).toHaveBeenCalledWith('/document-reversals/web/5/approve');
    expect(r.status).toBe(DocumentReversalStatus.approved);
    expect(r.reversalReference).toBe('REV-ST-2026-0031');
  });

  test('reject carries the reason', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({
      ...reversalDto,
      status: 'REJECTED',
      decisionNote: 'The count was wrong',
    });

    const r = await documentReversalsService.reject(5, {
      reason: 'The count was wrong',
    });

    expect(post).toHaveBeenCalledWith('/document-reversals/web/5/reject', {
      reason: 'The count was wrong',
    });
    expect(r.status).toBe(DocumentReversalStatus.rejected);
  });

  test('cancel is a bare POST on the request', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({
      ...reversalDto,
      status: 'CANCELLED',
    });

    await documentReversalsService.cancel(5);

    expect(post).toHaveBeenCalledWith('/document-reversals/web/5/cancel');
  });

  test('the queue is one page filtered to a status', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      content: [reversalDto],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    });

    const page = await documentReversalsService.getAllPaginated(
      0,
      10,
      DocumentReversalStatus.pending
    );

    expect(get).toHaveBeenCalledWith('/document-reversals/web', {
      pageNo: 0,
      pageSize: 10,
      status: 'PENDING',
    });
    expect(page.totalElements).toBe(1);
    expect(page.content[0].id).toBe(5);
  });

  test('eligibility and by-document name the document in the query', async () => {
    const get = spyOn(api, 'get')
      .mockResolvedValueOnce({ reversible: true, callerIsCreator: true })
      .mockResolvedValueOnce([reversalDto]);

    const e = await documentReversalsService.getEligibility(
      ReversibleDocumentType.purchaseOrder,
      9
    );
    const list = await documentReversalsService.getByDocument(
      ReversibleDocumentType.purchaseOrder,
      9
    );

    expect(get).toHaveBeenNthCalledWith(1, '/document-reversals/web/eligibility', {
      documentType: 'PURCHASE_ORDER',
      documentId: 9,
    });
    expect(get).toHaveBeenNthCalledWith(2, '/document-reversals/web/by-document', {
      documentType: 'PURCHASE_ORDER',
      documentId: 9,
    });
    expect(e.reversible).toBe(true);
    expect(list).toHaveLength(1);
  });
});
