import { describe, expect, test } from 'bun:test';
import { parseOrganization } from './organization';

describe('parseOrganization boundary validation', () => {
  test('parses a valid response and defaults absent fields', () => {
    const org = parseOrganization({ id: 3, organizationName: 'Acme' });
    expect(org.id).toBe(3);
    expect(org.organizationName).toBe('Acme');
    expect(org.isActive).toBe(true);
  });

  test('rejects a missing id', () => {
    expect(() => parseOrganization({ organizationName: 'x' })).toThrow();
  });
});
