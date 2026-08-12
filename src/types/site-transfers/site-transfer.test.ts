import { describe, expect, test } from 'bun:test';
import { parseSiteTransfer } from './site-transfer';
import { SiteTransferStatus } from './enums';

const validPayload = {
  id: 1,
  transferNumber: 'ST-0001',
  issueDate: '2026-01-01',
  sendingPerson: { id: 4, employeeName: 'Meera' },
  status: 'COMPLETED',
  items: [{ id: 9, materialId: 2, sentQuantity: '3' }],
};

describe('parseSiteTransfer', () => {
  test('parses a valid payload with nested items', () => {
    const t = parseSiteTransfer(validPayload);
    expect(t.id).toBe(1);
    expect(t.sendingPerson.name).toBe('Meera');
    expect(t.status).toBe(SiteTransferStatus.completed);
    expect(t.items[0].sentQuantity).toBe(3);
  });

  test('throws when id is not a positive integer', () => {
    expect(() => parseSiteTransfer({ ...validPayload, id: 0 })).toThrow();
  });
});
