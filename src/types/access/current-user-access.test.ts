import { describe, expect, test } from 'bun:test';
import { holdsPermission, parseCurrentUserAccess } from './current-user-access';

const backendShape = {
  organizationId: 5,
  employeeId: 42,
  grants: {
    'assets:view': ['ALL'],
    'assets:create': ['ALL'],
    'leave:create': ['OWN'],
  },
};

describe('parseCurrentUserAccess boundary validation', () => {
  test('parses the backend shape', () => {
    const access = parseCurrentUserAccess(backendShape);
    expect(access.organizationId).toBe(5);
    expect(access.employeeId).toBe(42);
    expect(access.grants['assets:create']).toEqual(['ALL']);
    expect(access.grants['leave:create']).toEqual(['OWN']);
  });

  test('reads missing grants as holding nothing', () => {
    expect(parseCurrentUserAccess({ organizationId: 5, employeeId: 42 }).grants).toEqual({});
  });

  test('drops a scope it does not know, and a permission left with none', () => {
    const access = parseCurrentUserAccess({
      ...backendShape,
      grants: { 'assets:view': ['ALL', 'REGION'], 'assets:edit': ['REGION'] },
    });
    expect(access.grants).toEqual({ 'assets:view': ['ALL'] });
  });

  test('rejects a payload without the membership it describes', () => {
    expect(() => parseCurrentUserAccess({ grants: {} })).toThrow();
  });
});

describe('holdsPermission', () => {
  const access = parseCurrentUserAccess(backendShape);

  test('holds a permission at any scope it was given', () => {
    expect(holdsPermission(access, 'assets', 'create')).toBe(true);
    expect(holdsPermission(access, 'leave', 'create')).toBe(true);
  });

  test('does not hold a permission it was not given', () => {
    expect(holdsPermission(access, 'assets', 'delete')).toBe(false);
  });

  test('checks the scope when one is asked for', () => {
    expect(holdsPermission(access, 'leave', 'create', 'OWN')).toBe(true);
    expect(holdsPermission(access, 'leave', 'create', 'ALL')).toBe(false);
  });

  test('holds nothing while the access is still loading', () => {
    expect(holdsPermission(undefined, 'assets', 'view')).toBe(false);
  });
});
