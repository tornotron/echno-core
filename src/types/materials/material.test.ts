import { describe, expect, test } from 'bun:test';
import { parseMaterial, parseMaterialWithStock } from './material';

const validPayload = {
  id: 1,
  materialName: 'Cement',
  unit: 'kg',
  currentStock: '250.5',
};

describe('parseMaterial', () => {
  test('parses a minimal valid payload and coerces stock', () => {
    const m = parseMaterial(validPayload);
    expect(m.id).toBe(1);
    expect(m.materialName).toBe('Cement');
    expect(m.currentStock).toBe(250.5);
  });

  test('throws when id is not a positive integer', () => {
    expect(() => parseMaterial({ ...validPayload, id: 0 })).toThrow();
  });

  test('defaults currentStock to 0 on the stock variant when absent', () => {
    const m = parseMaterialWithStock({ id: 1, materialName: 'Sand', unit: 'kg' });
    expect(m.currentStock).toBe(0);
  });
});
