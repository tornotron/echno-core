import { describe, expect, test } from 'bun:test';
import { parseLowStockMaterial } from './low-stock-material';

const validPayload = {
  materialId: 12,
  sku: 'TNT-STEEL-001',
  materialName: 'TNT Steel',
  unit: 'kg',
  currentStock: 1,
  reorderLevel: 30,
  shortfall: 29,
  moq: null,
  projectId: 5,
  storageLocationId: 2,
};

describe('parseLowStockMaterial', () => {
  test('parses a location-scoped row', () => {
    const m = parseLowStockMaterial(validPayload);
    expect(m.materialId).toBe(12);
    expect(m.sku).toBe('TNT-STEEL-001');
    expect(m.unit).toBe('kg');
    expect(m.currentStock).toBe(1);
    expect(m.reorderLevel).toBe(30);
    expect(m.shortfall).toBe(29);
    expect(m.moq).toBeUndefined();
    expect(m.projectId).toBe(5);
    expect(m.storageLocationId).toBe(2);
  });

  test('keeps a stock of zero, which is the row most worth seeing', () => {
    const m = parseLowStockMaterial({ ...validPayload, currentStock: 0 });
    expect(m.currentStock).toBe(0);
  });

  test('keeps a reorder level of zero, which counts as set', () => {
    const m = parseLowStockMaterial({
      ...validPayload,
      reorderLevel: 0,
      shortfall: 0,
    });
    expect(m.reorderLevel).toBe(0);
    expect(m.shortfall).toBe(0);
  });

  test('coerces a quantity the driver sent as a string', () => {
    const m = parseLowStockMaterial({ ...validPayload, currentStock: '1.5' });
    expect(m.currentStock).toBe(1.5);
  });

  test('throws rather than defaulting a missing stock to zero', () => {
    expect(() =>
      parseLowStockMaterial({ ...validPayload, currentStock: null })
    ).toThrow();
  });

  test('throws rather than defaulting a missing reorder level to zero', () => {
    const { reorderLevel: _dropped, ...withoutLevel } = validPayload;
    expect(() => parseLowStockMaterial(withoutLevel)).toThrow();
  });

  test('throws when materialId is not a positive integer', () => {
    expect(() =>
      parseLowStockMaterial({ ...validPayload, materialId: 0 })
    ).toThrow();
  });
});
