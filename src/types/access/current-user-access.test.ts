import { describe, expect, test } from 'bun:test';
import { holdsPermission, holdsPermissionOnProject, parseCurrentUserAccess } from './current-user-access';

const backendShape = {
  organizationId: 5,
  employeeId: 42,
  grants: {
    'assets:read': ['ALL'],
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
      grants: { 'assets:read': ['ALL', 'REGION'], 'assets:edit': ['REGION'] },
    });
    expect(access.grants).toEqual({ 'assets:read': ['ALL'] });
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
    expect(holdsPermission(undefined, 'assets', 'read')).toBe(false);
  });
});

describe('project grants', () => {
  const access = parseCurrentUserAccess({
    ...backendShape,
    projectGrants: {
      '11': { 'finance:read': ['ALL'], 'finance:edit': ['OWN', 'REGION'] },
      '12': { 'finance:read': ['REGION'] },
    },
  });

  test('parses each project by its numeric id, and drops a project left with no known scope', () => {
    expect(access.projectGrants).toEqual({ 11: { 'finance:read': ['ALL'], 'finance:edit': ['OWN'] } });
  });

  test('reads missing project grants as none', () => {
    expect(parseCurrentUserAccess(backendShape).projectGrants).toEqual({});
  });

  test('a project grant counts on its project only, and not across the organization', () => {
    expect(holdsPermissionOnProject(access, 11, 'finance', 'read')).toBe(true);
    expect(holdsPermissionOnProject(access, 12, 'finance', 'read')).toBe(false);
    expect(holdsPermission(access, 'finance', 'read')).toBe(false);
  });

  test('an organization-wide grant counts on every project', () => {
    expect(holdsPermissionOnProject(access, 99, 'assets', 'create')).toBe(true);
  });

  test('checks the scope on the project when one is asked for', () => {
    expect(holdsPermissionOnProject(access, 11, 'finance', 'edit', 'OWN')).toBe(true);
    expect(holdsPermissionOnProject(access, 11, 'finance', 'edit', 'ALL')).toBe(false);
  });

  test('holds nothing while the access is still loading', () => {
    expect(holdsPermissionOnProject(undefined, 11, 'finance', 'read')).toBe(false);
  });
});
