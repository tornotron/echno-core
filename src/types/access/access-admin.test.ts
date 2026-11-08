import { describe, expect, test } from 'bun:test';
import {
  offeredScopes,
  parseAccessCatalog,
  parseAccessRole,
  parseAccessRoleCreated,
  parseAccessUser,
} from './access-admin';

const memberRole = {
  id: 'ca5d3515-fd6c-4928-910b-5640d3ddb622',
  slug: 'member',
  name: 'Member',
  subtitle: null,
  description: 'What everyone in the organization holds.',
  system: true,
  baseline: true,
  carriedOver: false,
  organizationWideOnly: false,
  grants: [
    { permission: 'assets:read', scope: 'ALL' },
    { permission: 'leave:create', scope: 'OWN' },
  ],
  assignments: [],
  grantableRoleIds: [],
};

const catalogShape = {
  sections: ['Bills'],
  scopes: ['ALL', 'ASSIGNED_PROJECTS', 'RELATED', 'OWN'],
  areas: [
    {
      id: 'progress-bills',
      label: 'Progress Bills',
      section: 'Bills',
      actions: [
        { action: 'read', enforced: true },
        { action: 'create', enforced: true },
        { action: 'certify', enforced: false },
      ],
      scopeAware: true,
    },
    {
      id: 'assets',
      label: 'Assets',
      section: 'Bills',
      actions: [{ action: 'read', enforced: true }],
      scopeAware: false,
    },
  ],
};

describe('parseAccessCatalog', () => {
  test('parses sections, areas with their actions and enforced flags, and scopes', () => {
    const catalog = parseAccessCatalog(catalogShape);
    const [bills] = catalog.areas;
    expect(catalog.sections).toEqual(['Bills']);
    expect(bills.actions).toEqual(['read', 'create', 'certify']);
    expect(bills.enforcedActions).toEqual(['read', 'create']);
    expect(bills.actionDetails[2]).toEqual({ action: 'certify', enforced: false });
    expect(bills.scopeAware).toBe(true);
  });

  test('reads an area without the scope-aware flag as not scope aware', () => {
    const { scopeAware: _s, ...bare } = catalogShape.areas[0];
    expect(parseAccessCatalog({ areas: [bare] }).areas[0].scopeAware).toBe(false);
  });

  test('reads a bare action name as not enforced, so it is never offered', () => {
    const catalog = parseAccessCatalog({ areas: [{ id: 'a', label: 'A', section: 'S', actions: ['read'] }] });
    const area = catalog.areas[0];
    expect(area.actions).toEqual(['read']);
    expect(area.enforcedActions).toEqual([]);
  });

  test('throws on an area without an id', () => {
    expect(() => parseAccessCatalog({ areas: [{ label: 'x', section: 'y' }] })).toThrow();
  });
});

describe('offeredScopes', () => {
  test('offers every scope on a scope-aware area and only ALL elsewhere', () => {
    const catalog = parseAccessCatalog(catalogShape);
    expect(offeredScopes(catalog, catalog.areas[0])).toEqual(catalogShape.scopes);
    expect(offeredScopes(catalog, catalog.areas[1])).toEqual(['ALL']);
  });
});

describe('parseAccessRole', () => {
  test('parses the backend shape and reads a null subtitle as absent', () => {
    const role = parseAccessRole(memberRole);
    expect(role.baseline).toBe(true);
    expect(role.subtitle).toBeUndefined();
    expect(role.grants).toEqual([
      { permission: 'assets:read', scope: 'ALL', locked: false },
      { permission: 'leave:create', scope: 'OWN', locked: false },
    ]);
  });

  test('reads assignments with their projects, and derives the distinct members', () => {
    const role = parseAccessRole({
      ...memberRole,
      baseline: false,
      organizationWideOnly: true,
      assignments: [
        { employeeId: 4, projectId: null },
        { employeeId: 4, projectId: 11 },
        { employeeId: 9, projectId: 11 },
      ],
    });
    expect(role.assignments).toEqual([
      { employeeId: 4 },
      { employeeId: 4, projectId: 11 },
      { employeeId: 9, projectId: 11 },
    ]);
    expect(role.memberIds).toEqual([4, 9]);
    expect(role.organizationWideOnly).toBe(true);
    expect(role.carriedOver).toBe(false);
  });

  test('keeps a scope it does not know, as the server sent it', () => {
    const role = parseAccessRole({ ...memberRole, grants: [{ permission: 'assets:read', scope: 'REGION' }] });
    expect(role.grants[0].scope).toBe('REGION');
  });

  test('reads missing lists and flags as empty and false', () => {
    const {
      grants: _g,
      assignments: _a,
      grantableRoleIds: _r,
      carriedOver: _c,
      organizationWideOnly: _o,
      ...bare
    } = memberRole;
    const role = parseAccessRole(bare);
    expect(role.grants).toEqual([]);
    expect(role.assignments).toEqual([]);
    expect(role.memberIds).toEqual([]);
    expect(role.grantableRoleIds).toEqual([]);
    expect(role.carriedOver).toBe(false);
  });
});

describe('parseAccessUser', () => {
  test('parses a person with no roles or grants of their own', () => {
    const user = parseAccessUser({
      employeeId: 3,
      name: 'Arun Member',
      email: 'arun@example.com',
      designation: null,
      active: true,
      roles: [],
      grants: [],
    });
    expect(user.employeeId).toBe(3);
    expect(user.designation).toBeUndefined();
    expect(user.roles).toEqual([]);
    expect(user.roleIds).toEqual([]);
  });

  test('reads roles and grants with their projects, and derives the distinct role ids', () => {
    const user = parseAccessUser({
      employeeId: 3,
      name: 'Arun Member',
      active: true,
      roles: [
        { roleId: 'r-1', projectId: 11 },
        { roleId: 'r-1', projectId: 12 },
        { roleId: 'r-2', projectId: null },
      ],
      grants: [{ permission: 'assets:edit', scope: 'ALL', projectId: 11 }],
    });
    expect(user.roles[2]).toEqual({ roleId: 'r-2' });
    expect(user.roleIds).toEqual(['r-1', 'r-2']);
    expect(user.grants).toEqual([{ permission: 'assets:edit', scope: 'ALL', locked: false, projectId: 11 }]);
  });

  test('throws without an employee id', () => {
    expect(() => parseAccessUser({ name: 'x', active: true })).toThrow();
  });
});

describe('parseAccessRoleCreated', () => {
  test('parses the id and slug', () => {
    expect(parseAccessRoleCreated({ id: 'r-9', slug: 'finance-manager-2' })).toEqual({
      id: 'r-9',
      slug: 'finance-manager-2',
    });
  });

  test('throws without a slug', () => {
    expect(() => parseAccessRoleCreated({ id: 'r-9' })).toThrow();
  });
});
