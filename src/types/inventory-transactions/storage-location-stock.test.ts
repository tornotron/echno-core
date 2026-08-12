import { describe, expect, test } from 'bun:test';
import { parseStorageLocationStock } from './storage-location-stock';

describe('parseStorageLocationStock', () => {
  test('parses a valid payload and applies defaults', () => {
    const s = parseStorageLocationStock({
      storageLocationId: 2,
      storageLocationName: 'Main store',
      projectId: 3,
      totalStock: '10',
      materialStock: [
        { materialId: 1, materialName: 'Cement', unit: 'kg', stock: '5' },
      ],
    });
    expect(s.storageLocationId).toBe(2);
    expect(s.totalStock).toBe(10);
    expect(s.totalStockValue).toBe(0);
    expect(s.materialStock[0].stock).toBe(5);
    expect(s.materialStock[0].stockValue).toBe(0);
  });

  test('throws when a numeric field has a non-numeric type', () => {
    expect(() =>
      parseStorageLocationStock({ storageLocationId: 'not-a-number' })
    ).toThrow();
  });
});
