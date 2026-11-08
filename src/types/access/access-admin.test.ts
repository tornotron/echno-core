import { describe, expect, test } from 'bun:test';
import { parseAccessCatalog, parseAccessRole, parseAccessUser } from './access-admin';

const memberRole = {
  id: 'ca5d3515-fd6c-4928-910b-5640d3ddb622',
  slug: 'member',
  name: 'Member',
  subtitle: null,
  description: 'What everyone in the organization holds.',
  system: true,
  baseline: true,
  grants: [
    { permission: 'assets:view', scope: 'ALL', locked: false },
    { permission: 'leave:create', scope: 'OWN', locked: true },
  ],
  memberIds: [],
  grantableRoleIds: [],
};

describe('parseAccessCatalog', () => {
  test('parses sections, areas with their actions, and scopes', () => {
    const catalog = parseAccessCatalog({
      sections: ['Bills'],
      scopes: ['ALL', 'OWN'],
      areas: [
        {
          id: 'progress-bills',
          label: 'Progress Bills',
          section: 'Bills',
          actions: ['view', 'create', 'certify'],
        },
      ],
    });
    expect(catalog.sections).toEqual(['Bills']);
    expect(catalog.scopes).toEqual(['ALL', 'OWN']);
    expect(catalog.areas[0].actions).toEqual(['view', 'create', 'certify']);
  });

  test('throws on an area without an id', () => {
    expect(() => parseAccessCatalog({ areas: [{ label: 'x', section: 'y' }] })).toThrow();
  });
});

describe('parseAccessRole', () => {
  test('parses the backend shape and reads a null subtitle as absent', () => {
    const role = parseAccessRole(memberRole);
    expect(role.baseline).toBe(true);
    expect(role.subtitle).toBeUndefined();
    expect(role.grants).toEqual([
      { permission: 'assets:view', scope: 'ALL', locked: false },
      { permission: 'leave:create', scope: 'OWN', locked: true },
    ]);
  });

  test('keeps a scope it does not know, as the server sent it', () => {
    const role = parseAccessRole({
      ...memberRole,
      grants: [{ permission: 'assets:view', scope: 'REGION', locked: false }],
    });
    expect(role.grants[0].scope).toBe('REGION');
  });

  test('reads missing lists as empty', () => {
    const { grants: _g, memberIds: _m, grantableRoleIds: _r, ...bare } = memberRole;
    const role = parseAccessRole(bare);
    expect(role.grants).toEqual([]);
    expect(role.memberIds).toEqual([]);
    expect(role.grantableRoleIds).toEqual([]);
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
      roleIds: [],
      grants: [],
    });
    expect(user.employeeId).toBe(3);
    expect(user.designation).toBeUndefined();
    expect(user.roleIds).toEqual([]);
  });

  test('throws without an employee id', () => {
    expect(() => parseAccessUser({ name: 'x', active: true })).toThrow();
  });
});
