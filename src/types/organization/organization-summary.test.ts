import { describe, expect, test } from 'bun:test';
import { parseOrganizationSummary } from './organization-summary';
import type { OrganizationSummary } from './organization-summary';
import type { Organization } from './organization';

describe('parseOrganizationSummary', () => {
  test('parses an OrganizationSimpleDto payload', () => {
    const summary = parseOrganizationSummary({
      id: 7,
      organizationName: 'Acme',
      organizationAddress: '12 Marina Road',
      organizationEmail: 'ops@acme.test',
      organizationPhone: '+91 9000000000',
      organizationWebsite: 'https://acme.test',
      organizationLogo: null,
      creatorId: 3,
      createdAt: '2026-01-15T09:00:00',
      isActive: true,
    });
    expect(summary.id).toBe(7);
    expect(summary.organizationName).toBe('Acme');
    expect(summary.organizationWebsite).toBe('https://acme.test');
    expect(summary.organizationLogo).toBeUndefined();
    expect(summary.creatorId).toBe(3);
    expect(summary.createdAt).toBeInstanceOf(Date);
    expect(summary.isActive).toBe(true);
  });

  test('defaults absent scalars and ignores unknown keys', () => {
    const summary = parseOrganizationSummary({
      id: 3,
      organizationName: 'Acme',
      employees: [{ id: 1 }],
    });
    expect(summary.organizationAddress).toBe('');
    expect(summary.isActive).toBe(true);
    expect(summary.creatorId).toBe(0);
    expect('employees' in summary).toBe(false);
  });

  test('rejects a missing id', () => {
    expect(() => parseOrganizationSummary({ organizationName: 'x' })).toThrow();
  });

  test('a full Organization is assignable to OrganizationSummary', () => {
    const full: Organization = {
      id: 1,
      organizationName: 'Acme',
      organizationAddress: '',
      organizationEmail: '',
      organizationPhone: '',
      creatorId: 1,
      isActive: true,
    };
    const summary: OrganizationSummary = full;
    expect(summary.id).toBe(1);
  });
});
