import { describe, expect, test } from 'bun:test';
import { parseVendor } from './vendor';

describe('parseVendor', () => {
  test('parses a minimal payload and coerces string money fields', () => {
    const vendor = parseVendor({
      id: 7,
      vendorName: 'Acme',
      totalPaid: '1500.50',
    });
    expect(vendor.id).toBe(7);
    expect(vendor.name).toBe('Acme');
    expect(vendor.email).toBe('');
    expect(vendor.totalPaid).toBe(1500.5);
  });

  test('throws when the vendor has no name', () => {
    expect(() => parseVendor({ id: 7 })).toThrow();
  });

  test('throws when id is not a positive integer', () => {
    expect(() => parseVendor({ id: -3, vendorName: 'Acme' })).toThrow();
  });
});
