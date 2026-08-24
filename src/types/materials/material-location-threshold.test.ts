import { describe, expect, test } from 'bun:test';
import {
  materialLocationThresholdToJson,
  parseMaterialLocationThreshold,
} from './material-location-threshold';

const validPayload = {
  id: 7,
  materialId: 3,
  storageLocationId: 5,
  storageLocationName: 'Site A Godown',
  minStock: 10,
  reorderLevel: 20,
};

describe('parseMaterialLocationThreshold', () => {
  test('parses a valid payload and coerces absent thresholds to undefined', () => {
    const t = parseMaterialLocationThreshold(validPayload);
    expect(t.id).toBe(7);
    expect(t.materialId).toBe(3);
    expect(t.storageLocationId).toBe(5);
    expect(t.storageLocationName).toBe('Site A Godown');
    expect(t.minStock).toBe(10);
    expect(t.reorderLevel).toBe(20);
    expect(t.maxStock).toBeUndefined();
    expect(t.safetyStock).toBeUndefined();
    expect(t.moq).toBeUndefined();
  });

  test('defaults a missing storageLocationName to an empty string', () => {
    const t = parseMaterialLocationThreshold({
      ...validPayload,
      storageLocationName: null,
    });
    expect(t.storageLocationName).toBe('');
  });

  test('throws when id is not a positive integer', () => {
    expect(() =>
      parseMaterialLocationThreshold({ ...validPayload, id: 0 })
    ).toThrow();
  });
});

describe('materialLocationThresholdToJson', () => {
  test('omits unset fields and preserves an explicit null', () => {
    const body = materialLocationThresholdToJson({ minStock: 15, maxStock: null });
    expect(body).toEqual({ minStock: 15, maxStock: null });
  });

  test('produces an empty body when nothing is set', () => {
    expect(materialLocationThresholdToJson({})).toEqual({});
  });
});
