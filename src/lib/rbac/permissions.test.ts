import { describe, expect, test } from 'bun:test';

import { hasAllRoles, hasRole } from './permissions';

describe('hasRole', () => {
  const userRoles = ['system-admin', 'project-manager'];

  test('single required role that is present returns true', () => {
    expect(hasRole(userRoles, 'system-admin')).toBe(true);
  });

  test('single required role that is absent returns false', () => {
    expect(hasRole(userRoles, 'hr-admin')).toBe(false);
  });

  test('array of required roles uses OR: one match is enough', () => {
    expect(hasRole(userRoles, ['hr-admin', 'project-manager'])).toBe(true);
  });

  test('array of required roles returns false when none match', () => {
    expect(hasRole(userRoles, ['hr-admin', 'billing-admin'])).toBe(false);
  });

  test('empty required array returns false (no role can satisfy it)', () => {
    expect(hasRole(userRoles, [])).toBe(false);
  });

  test('empty user roles returns false for any required role', () => {
    expect(hasRole([], 'system-admin')).toBe(false);
    expect(hasRole([], ['system-admin', 'hr-admin'])).toBe(false);
  });

  test('matching is case-sensitive', () => {
    expect(hasRole(userRoles, 'System-Admin')).toBe(false);
  });
});

describe('hasAllRoles', () => {
  const userRoles = ['system-admin', 'project-manager', 'hr-admin'];

  test('returns true when every required role is present', () => {
    expect(hasAllRoles(userRoles, ['system-admin', 'hr-admin'])).toBe(true);
  });

  test('returns false when any required role is missing', () => {
    expect(hasAllRoles(userRoles, ['system-admin', 'billing-admin'])).toBe(false);
  });

  test('an empty required list is vacuously satisfied', () => {
    expect(hasAllRoles(userRoles, [])).toBe(true);
  });

  test('empty user roles fails a non-empty requirement', () => {
    expect(hasAllRoles([], ['system-admin'])).toBe(false);
  });

  test('duplicate required roles do not change the result', () => {
    expect(hasAllRoles(userRoles, ['hr-admin', 'hr-admin'])).toBe(true);
  });

  test('matching is case-sensitive', () => {
    expect(hasAllRoles(userRoles, ['System-Admin'])).toBe(false);
  });
});
