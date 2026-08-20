import { describe, expect, test } from 'bun:test';
import {
  parseConstructionInvoice,
  ConstructionInvoiceType,
  ConstructionInvoiceStatus,
} from './construction-invoice';

const UUID = '11111111-1111-1111-1111-111111111111';

// The backend serializes the BigDecimal money fields as strings; the boundary
// coerces them to numbers instead of passing the string through (which broke
// arithmetic) or fabricating 0.
describe('parseConstructionInvoice', () => {
  test('parses a valid payload with enums and lines', () => {
    const invoice = parseConstructionInvoice({
      id: UUID,
      invoiceNumber: 'INV-001',
      type: 'PURCHASE',
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      projectId: 7,
      totalAmount: '2500.00',
      lines: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          description: 'Cement',
          quantity: '10',
          unit: 'bag',
          unitPrice: '250.00',
        },
      ],
    });
    expect(invoice.id).toBe(UUID);
    expect(invoice.type).toBe(ConstructionInvoiceType.PURCHASE);
    expect(invoice.status).toBe(ConstructionInvoiceStatus.PENDING);
    expect(invoice.projectId).toBe(7);
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0]!.quantity).toBe(10);
  });

  test('coerces a string-serialized total to a number', () => {
    const invoice = parseConstructionInvoice({
      id: UUID,
      projectId: 1,
      totalAmount: '1500.50',
    });
    expect(invoice.totalAmount).toBe(1500.5);
  });

  test('defaults a missing total to 0', () => {
    expect(
      parseConstructionInvoice({ id: UUID, projectId: 1 }).totalAmount
    ).toBe(0);
  });

  test('falls back to default enums on an unknown value', () => {
    const invoice = parseConstructionInvoice({
      id: UUID,
      projectId: 1,
      type: 'BOGUS',
    });
    expect(invoice.type).toBe(ConstructionInvoiceType.PURCHASE);
    expect(invoice.status).toBe(ConstructionInvoiceStatus.DRAFT);
  });

  test('rejects a missing id instead of fabricating one', () => {
    expect(() => parseConstructionInvoice({ projectId: 1 })).toThrow();
  });

  test('rejects a blank id', () => {
    expect(() =>
      parseConstructionInvoice({ id: '   ', projectId: 1 })
    ).toThrow();
  });

  test('accepts the APPROVED status', () => {
    const invoice = parseConstructionInvoice({
      id: UUID,
      projectId: 1,
      status: 'APPROVED',
    });
    expect(invoice.status).toBe(ConstructionInvoiceStatus.APPROVED);
  });

  test('parses the approval-workflow audit fields', () => {
    const journalId = '33333333-3333-3333-3333-333333333333';
    const reversalId = '44444444-4444-4444-4444-444444444444';
    const invoice = parseConstructionInvoice({
      id: UUID,
      projectId: 1,
      status: 'APPROVED',
      submittedBy: 12,
      submittedAt: '2026-08-20T10:30:00Z',
      approvedBy: 34,
      approvedAt: '2026-08-21T09:00:00Z',
      paymentRecordedBy: 56,
      journalEntryId: journalId,
      reversalJournalEntryId: reversalId,
    });
    expect(invoice.submittedBy).toBe(12);
    expect(invoice.submittedAt).toBe('2026-08-20T10:30:00Z');
    expect(invoice.approvedBy).toBe(34);
    expect(invoice.approvedAt).toBe('2026-08-21T09:00:00Z');
    expect(invoice.paymentRecordedBy).toBe(56);
    expect(invoice.journalEntryId).toBe(journalId);
    expect(invoice.reversalJournalEntryId).toBe(reversalId);
  });

  test('leaves the workflow audit fields undefined when absent', () => {
    const invoice = parseConstructionInvoice({ id: UUID, projectId: 1 });
    expect(invoice.submittedBy).toBeUndefined();
    expect(invoice.submittedAt).toBeUndefined();
    expect(invoice.approvedBy).toBeUndefined();
    expect(invoice.approvedAt).toBeUndefined();
    expect(invoice.paymentRecordedBy).toBeUndefined();
    expect(invoice.journalEntryId).toBeUndefined();
    expect(invoice.reversalJournalEntryId).toBeUndefined();
  });
});
