import { describe, expect, test } from 'bun:test';
import { parseMaterialStockSummary } from './material-stock-summary';

const validPayload = {
  projectId: null,
  materialCount: 743,
  distinctUnits: 9,
  totalStockValue: 50148300.0,
  unvaluedHoldingCount: 0,
};

describe('parseMaterialStockSummary', () => {
  test('parses an organization-wide summary', () => {
    const s = parseMaterialStockSummary(validPayload);
    expect(s.projectId).toBeUndefined();
    expect(s.materialCount).toBe(743);
    expect(s.distinctUnits).toBe(9);
    expect(s.totalStockValue).toBe(50148300);
    expect(s.unvaluedHoldingCount).toBe(0);
  });

  test('keeps the project the figures were totalled within', () => {
    const s = parseMaterialStockSummary({ ...validPayload, projectId: 5 });
    expect(s.projectId).toBe(5);
  });

  test('coerces a value the driver sent as a string', () => {
    const s = parseMaterialStockSummary({
      ...validPayload,
      totalStockValue: '50148300.00',
    });
    expect(s.totalStockValue).toBe(50148300);
  });

  test('keeps a value of zero, which is what an empty store holds', () => {
    const s = parseMaterialStockSummary({
      ...validPayload,
      totalStockValue: 0,
      materialCount: 0,
      distinctUnits: 0,
    });
    expect(s.totalStockValue).toBe(0);
    expect(s.materialCount).toBe(0);
    expect(s.distinctUnits).toBe(0);
  });

  test('keeps the count of holdings the total could not price', () => {
    const s = parseMaterialStockSummary({
      ...validPayload,
      unvaluedHoldingCount: 4,
    });
    expect(s.unvaluedHoldingCount).toBe(4);
  });

  test('throws rather than defaulting a missing value to zero', () => {
    const { totalStockValue: _dropped, ...withoutValue } = validPayload;
    expect(() => parseMaterialStockSummary(withoutValue)).toThrow();
  });

  test('throws rather than defaulting a null value to zero', () => {
    expect(() =>
      parseMaterialStockSummary({ ...validPayload, totalStockValue: null })
    ).toThrow();
  });

  test('throws rather than defaulting a missing material count to zero', () => {
    const { materialCount: _dropped, ...withoutCount } = validPayload;
    expect(() => parseMaterialStockSummary(withoutCount)).toThrow();
  });

  test('throws rather than defaulting a missing unit count to zero', () => {
    const { distinctUnits: _dropped, ...withoutUnits } = validPayload;
    expect(() => parseMaterialStockSummary(withoutUnits)).toThrow();
  });

  test('throws rather than defaulting a missing unvalued count to zero', () => {
    const { unvaluedHoldingCount: _dropped, ...withoutUnvalued } = validPayload;
    expect(() => parseMaterialStockSummary(withoutUnvalued)).toThrow();
  });

  test('throws rather than reading a null material count as zero', () => {
    // `z.coerce.number()` turns null into 0, so a null count would arrive
    // as an empty catalogue and nothing on screen would say otherwise.
    expect(() =>
      parseMaterialStockSummary({ ...validPayload, materialCount: null })
    ).toThrow();
  });

  test('throws rather than reading a null unit count as zero', () => {
    expect(() =>
      parseMaterialStockSummary({ ...validPayload, distinctUnits: null })
    ).toThrow();
  });

  test('throws rather than reading a null unvalued count as zero', () => {
    // Read as zero this one claims the total is complete, which is the
    // opposite of what a missing field can support.
    expect(() =>
      parseMaterialStockSummary({ ...validPayload, unvaluedHoldingCount: null })
    ).toThrow();
  });

  test('throws on a count sent as text that is not a number', () => {
    expect(() =>
      parseMaterialStockSummary({ ...validPayload, materialCount: '' })
    ).toThrow();
  });

  test('coerces a count the driver sent as a string', () => {
    const s = parseMaterialStockSummary({
      ...validPayload,
      materialCount: '743',
    });
    expect(s.materialCount).toBe(743);
  });

  test('throws on a count that is not a whole number', () => {
    expect(() =>
      parseMaterialStockSummary({ ...validPayload, materialCount: 7.5 })
    ).toThrow();
  });

  test('throws on a negative count, which no total can produce', () => {
    expect(() =>
      parseMaterialStockSummary({ ...validPayload, distinctUnits: -1 })
    ).toThrow();
  });
});
