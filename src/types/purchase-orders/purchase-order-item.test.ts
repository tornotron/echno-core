import { describe, expect, test } from 'bun:test';
import { parsePurchaseOrderItem } from './purchase-order-item';

describe('parsePurchaseOrderItem', () => {
  test('parses a minimal valid payload and defaults receivedQuantity', () => {
    const item = parsePurchaseOrderItem({
      id: 3,
      materialId: 11,
      materialName: 'Sand',
      orderedQuantity: 20,
    });
    expect(item.materialId).toBe(11);
    expect(item.receivedQuantity).toBe(0);
    expect(item.unitPrice).toBeUndefined();
  });

  // A BigDecimal unit price may arrive as a string; coerce it to a number.
  test('coerces a string-serialized unitPrice', () => {
    const item = parsePurchaseOrderItem({
      id: 3,
      materialId: 11,
      unitPrice: '9.99',
    });
    expect(item.unitPrice).toBe(9.99);
  });

  test('throws when materialId is missing', () => {
    expect(() => parsePurchaseOrderItem({ id: 3 })).toThrow();
  });
});
