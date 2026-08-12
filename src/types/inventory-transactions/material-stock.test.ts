import { describe, expect, test } from 'bun:test';
import { parseMaterialStock } from './material-stock';

const validPayload = {
  materialId: 1,
  materialName: 'Cement',
  totalStock: '120.5',
  totalStockValue: '4000',
  locationStock: [
    {
      storageLocationId: 2,
      storageLocationName: 'Main store',
      projectId: 3,
      projectName: 'Tower A',
      stock: '120.5',
      stockValue: '4000',
    },
  ],
};

describe('parseMaterialStock', () => {
  test('parses a valid payload and coerces stock values', () => {
    const s = parseMaterialStock(validPayload);
    expect(s.materialId).toBe(1);
    expect(s.totalStock).toBe(120.5);
    expect(s.locationStock[0].storageLocationId).toBe(2);
    expect(s.locationStock[0].stockValue).toBe(4000);
  });

  test('throws when materialId is not a positive integer', () => {
    expect(() => parseMaterialStock({ ...validPayload, materialId: -1 })).toThrow();
  });
});
