import { describe, expect, test } from 'bun:test';
import { parsePurchaseOrder } from './purchase-order';
import { PurchaseOrderStatus } from './enums';

describe('parsePurchaseOrder', () => {
  test('parses a minimal valid payload', () => {
    const po = parsePurchaseOrder({
      id: 7,
      poNumber: 'PO-010',
      vendorId: 4,
      status: 'APPROVED',
      createdAt: '2026-03-01T09:00:00Z',
      createdBy: { id: 2, employeeName: 'Meera' },
    });
    expect(po.vendorName).toBe('');
    expect(po.status).toBe(PurchaseOrderStatus.approved);
    expect(po.createdBy.name).toBe('Meera');
  });

  test('normalizes a string createdBy and falls back on an unknown status', () => {
    const po = parsePurchaseOrder({
      id: 7,
      vendorId: 4,
      status: 'BOGUS',
      createdBy: 'Legacy User',
    });
    expect(po.createdBy).toEqual({ id: 0, name: 'Legacy User' });
    expect(po.status).toBe(PurchaseOrderStatus.draft);
  });

  test('throws when vendorId is missing', () => {
    expect(() => parsePurchaseOrder({ id: 7, createdBy: 'x' })).toThrow();
  });
});
