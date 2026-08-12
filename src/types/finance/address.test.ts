import { describe, expect, test } from 'bun:test';
import { parseAddress } from './address';

describe('parseAddress', () => {
  test('parses a populated address', () => {
    const address = parseAddress({ line1: '1 Mount Rd', city: 'Chennai' });
    expect(address?.line1).toBe('1 Mount Rd');
    expect(address?.city).toBe('Chennai');
  });

  test('returns undefined for null input', () => {
    expect(parseAddress(null)).toBeUndefined();
  });

  test('throws on a malformed field', () => {
    expect(() => parseAddress({ line1: 42 })).toThrow();
  });
});
