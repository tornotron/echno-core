import { describe, expect, test } from 'bun:test';
import { parseSiteTransferItem } from './site-transfer-item';

describe('parseSiteTransferItem', () => {
  test('parses a valid payload and coerces sentQuantity', () => {
    const item = parseSiteTransferItem({
      id: 1,
      materialId: 2,
      materialName: 'Steel bar',
      sentQuantity: '15.5',
    });
    expect(item.id).toBe(1);
    expect(item.materialId).toBe(2);
    expect(item.sentQuantity).toBe(15.5);
  });

  test('throws when id is missing', () => {
    expect(() =>
      parseSiteTransferItem({ materialId: 2, sentQuantity: 3 })
    ).toThrow();
  });
});
