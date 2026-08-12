import { describe, expect, test } from 'bun:test';
import { parseGoodsReceivedNote } from './grn';

describe('parseGoodsReceivedNote', () => {
  test('parses a minimal valid payload', () => {
    const grn = parseGoodsReceivedNote({
      id: 5,
      grnNumber: 'GRN-001',
      receivedOn: '2026-01-15',
      receivedBy: { id: 3, employeeName: 'Asha' },
      vendorId: 9,
    });
    expect(grn.id).toBe(5);
    expect(grn.receivedBy.name).toBe('Asha');
    expect(grn.items).toEqual([]);
  });

  test('throws when vendorId is not a positive integer', () => {
    expect(() =>
      parseGoodsReceivedNote({
        id: 5,
        receivedBy: { id: 3 },
        vendorId: 0,
      })
    ).toThrow();
  });
});
