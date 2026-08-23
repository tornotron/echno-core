import { describe, expect, test } from 'bun:test';

import {
  backendDate,
  money,
  nullableBoolean,
  nullableNumber,
  nullableString,
  numericId,
  opaque,
  optionalNumericId,
} from './backend-schema';

describe('numericId', () => {
  test('accepts a positive integer and a numeric string (coerced)', () => {
    expect(numericId.parse(5)).toBe(5);
    expect(numericId.parse('42')).toBe(42);
  });

  test('rejects zero, negatives and non-integers', () => {
    expect(numericId.safeParse(0).success).toBe(false);
    expect(numericId.safeParse(-1).success).toBe(false);
    expect(numericId.safeParse(1.5).success).toBe(false);
  });

  test('rejects a non-numeric string', () => {
    expect(numericId.safeParse('abc').success).toBe(false);
  });
});

describe('optionalNumericId', () => {
  test('accepts a valid id or null/undefined', () => {
    expect(optionalNumericId.parse('7')).toBe(7);
    expect(optionalNumericId.parse(null)).toBeNull();
    expect(optionalNumericId.parse(undefined)).toBeUndefined();
  });

  test('still rejects an invalid non-null id', () => {
    expect(optionalNumericId.safeParse(0).success).toBe(false);
  });
});

describe('money', () => {
  test('coerces a numeric string and passes a number through', () => {
    expect(money.parse('12.50')).toBe(12.5);
    expect(money.parse(100)).toBe(100);
  });

  test('allows null/undefined (nullish) rather than fabricating 0', () => {
    expect(money.parse(null)).toBeNull();
    expect(money.parse(undefined)).toBeUndefined();
  });

  test('rejects a non-numeric string instead of yielding NaN', () => {
    expect(money.safeParse('not-a-number').success).toBe(false);
  });
});

describe('nullableString', () => {
  test('accepts a string or null/undefined, rejects a number', () => {
    expect(nullableString.parse('hello')).toBe('hello');
    expect(nullableString.parse(null)).toBeNull();
    expect(nullableString.safeParse(5).success).toBe(false);
  });
});

describe('backendDate', () => {
  test('keeps the raw string (conversion happens later) and allows null', () => {
    expect(backendDate.parse('2026-01-01T00:00:00Z')).toBe('2026-01-01T00:00:00Z');
    expect(backendDate.parse(null)).toBeNull();
  });
});

describe('nullableNumber', () => {
  test('accepts a number or null but does not coerce strings', () => {
    expect(nullableNumber.parse(5)).toBe(5);
    expect(nullableNumber.parse(null)).toBeNull();
    expect(nullableNumber.safeParse('5').success).toBe(false);
  });
});

describe('nullableBoolean', () => {
  test('accepts a boolean or null, rejects a truthy non-boolean', () => {
    expect(nullableBoolean.parse(true)).toBe(true);
    expect(nullableBoolean.parse(null)).toBeNull();
    expect(nullableBoolean.safeParse('true').success).toBe(false);
  });
});

describe('opaque', () => {
  test('passes any value through (dedicated parser handles it later)', () => {
    expect(opaque.parse({ any: 'shape' })).toEqual({ any: 'shape' });
    expect(opaque.parse([1, 2, 3])).toEqual([1, 2, 3]);
    expect(opaque.parse(null)).toBeNull();
  });
});
