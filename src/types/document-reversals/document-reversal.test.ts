import { describe, expect, test } from 'bun:test';
import { parseDocumentReversal } from './document-reversal';
import { parseDocumentReversalEligibility } from './document-reversal-eligibility';
import { DocumentReversalStatus, ReversibleDocumentType } from './enums';
import { parseSiteTransfer } from '../site-transfers/site-transfer';
import { SiteTransferStatus } from '../site-transfers/enums';

const validPayload = {
  id: 12,
  organizationId: 1,
  documentType: 'GOODS_RECEIVED_NOTE',
  documentId: 18,
  documentNumber: 'GRN-2026-0018',
  status: 'APPROVED',
  reason: 'Delivery booked to the wrong project',
  requestedBy: 7,
  requestedByName: 'Ravi Kumar',
  requestedAt: '2026-09-20T10:15:00',
  decidedBy: 3,
  decidedByName: 'Anand R',
  decidedAt: '2026-09-20T11:00:00',
  decisionNote: 'Approved; the document\'s movements were undone and the stores told.',
  reversalReference: 'REV-GRN-2026-0018',
  createdAt: '2026-09-20T10:15:00',
  updatedAt: '2026-09-20T11:00:00',
};

describe('parseDocumentReversal', () => {
  test('parses a decided request', () => {
    const r = parseDocumentReversal(validPayload);
    expect(r.id).toBe(12);
    expect(r.documentType).toBe(ReversibleDocumentType.goodsReceivedNote);
    expect(r.documentId).toBe(18);
    expect(r.status).toBe(DocumentReversalStatus.approved);
    expect(r.decidedByName).toBe('Anand R');
    expect(r.reversalReference).toBe('REV-GRN-2026-0018');
  });

  test('a pending request has no decision fields', () => {
    const r = parseDocumentReversal({
      ...validPayload,
      status: 'PENDING',
      decidedBy: null,
      decidedByName: null,
      decidedAt: null,
      decisionNote: null,
      reversalReference: null,
    });
    expect(r.status).toBe(DocumentReversalStatus.pending);
    expect(r.decidedBy).toBeUndefined();
    expect(r.reversalReference).toBeUndefined();
  });

  test('tolerates a field the server adds later', () => {
    const r = parseDocumentReversal({ ...validPayload, somethingNew: 'x' });
    expect(r.id).toBe(12);
  });

  test('throws when documentId is not a positive integer', () => {
    expect(() =>
      parseDocumentReversal({ ...validPayload, documentId: 0 })
    ).toThrow();
  });
});

describe('parseDocumentReversalEligibility', () => {
  test('reads the blocker and the caller flag', () => {
    const e = parseDocumentReversalEligibility({
      reversible: false,
      blocker: 'Purchase order PO-1 has goods received note GRN-2 receipted against it.',
      callerIsCreator: true,
      pendingReversalId: null,
      reversalId: null,
    });
    expect(e.reversible).toBe(false);
    expect(e.blocker).toContain('GRN-2');
    expect(e.callerIsCreator).toBe(true);
    expect(e.pendingReversalId).toBeUndefined();
  });

  test('absent booleans read as false, the safe side for a write control', () => {
    const e = parseDocumentReversalEligibility({});
    expect(e.reversible).toBe(false);
    expect(e.callerIsCreator).toBe(false);
  });
});

describe('a reversed document carries its reversal', () => {
  test('parseSiteTransfer reads REVERSED and reversalId', () => {
    const t = parseSiteTransfer({
      id: 1,
      transferNumber: 'ST-0001',
      issueDate: '2026-01-01',
      sendingPerson: { id: 4, employeeName: 'Meera' },
      status: 'REVERSED',
      reversalId: 12,
      items: [],
    });
    expect(t.status).toBe(SiteTransferStatus.reversed);
    expect(t.reversalId).toBe(12);
  });
});
