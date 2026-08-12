import { describe, expect, test } from 'bun:test';
import { parseIndentItem } from './indent-item';

describe('parseIndentItem', () => {
  test('parses flat material fields', () => {
    const item = parseIndentItem({
      id: 2,
      materialId: 8,
      materialName: 'Rebar',
      unit: 'kg',
      requestedQuantity: 500,
    });
    expect(item.material.id).toBe(8);
    expect(item.material.materialName).toBe('Rebar');
    expect(item.material.unit).toBe('kg');
    expect(item.convertedToPurchaseOrder).toBe(false);
  });

  test('throws when neither material.id nor materialId is present', () => {
    expect(() => parseIndentItem({ id: 2, requestedQuantity: 1 })).toThrow();
  });
});
