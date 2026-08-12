import { describe, expect, test } from 'bun:test';
import { parseInventoryTransaction } from './inventory-transaction';

const validPayload = {
  id: 1,
  transactionDate: '2026-01-01T00:00:00Z',
  materialId: 2,
  projectId: 3,
  storageLocationId: 4,
  quantityChanged: -5,
  transactionType: 'GRN',
  createdBy: { id: 7, employeeName: 'Asha' },
};

describe('parseInventoryTransaction', () => {
  test('parses a minimal valid payload', () => {
    const tx = parseInventoryTransaction(validPayload);
    expect(tx.id).toBe(1);
    expect(tx.quantityChanged).toBe(-5);
    expect(tx.createdBy.name).toBe('Asha');
  });

  test('coerces a string-serialized unitCost to a number', () => {
    const tx = parseInventoryTransaction({ ...validPayload, unitCost: '12.50' });
    expect(tx.unitCost).toBe(12.5);
  });

  test('throws when id is not a positive integer', () => {
    expect(() => parseInventoryTransaction({ ...validPayload, id: 0 })).toThrow();
  });
});
