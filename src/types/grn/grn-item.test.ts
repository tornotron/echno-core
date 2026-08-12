import { describe, expect, test } from 'bun:test';
import { parseGrnItem } from './grn-item';

describe('parseGrnItem', () => {
  test('parses a minimal valid payload', () => {
    const item = parseGrnItem({
      id: 1,
      materialId: 7,
      materialName: 'Cement',
      orderedQuantity: 100,
      receivedQuantity: 95,
    });
    expect(item.id).toBe(1);
    expect(item.materialName).toBe('Cement');
    expect(item.unitCost).toBeUndefined();
  });

  // The backend may serialize a BigDecimal cost as a string; the boundary
  // coerces it to a number rather than passing the string through.
  test('coerces a string-serialized unitCost to a number', () => {
    const item = parseGrnItem({ id: 1, materialId: 7, unitCost: '12.5' });
    expect(item.unitCost).toBe(12.5);
  });

  test('throws when id is missing', () => {
    expect(() => parseGrnItem({ materialId: 7 })).toThrow();
  });

  test('throws when materialId is not a positive integer', () => {
    expect(() => parseGrnItem({ id: 1, materialId: -3 })).toThrow();
  });
});
