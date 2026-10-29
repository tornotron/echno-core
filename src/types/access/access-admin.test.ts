import { describe, expect, test } from 'bun:test';
import { parseAccessCatalog, parseAccessGroup, parseAccessRole, parseAccessUser } from './access-admin';

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

  test('keeps a scope it does not know, so writing the grants back keeps it', () => {
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

describe('parseAccessGroup', () => {
  test('parses a department', () => {
    const group = parseAccessGroup({
      id: 'g-1',
      name: 'Site',
      description: null,
      kind: 'DEPARTMENT',
      grants: [{ permission: 'wbs:edit', scope: 'ASSIGNED_PROJECTS', locked: false }],
      memberIds: [3, 4],
      roleIds: ['r-1'],
    });
    expect(group.kind).toBe('DEPARTMENT');
    expect(group.memberIds).toEqual([3, 4]);
    expect(group.description).toBeUndefined();
  });

  test('throws on an unknown kind', () => {
    expect(() => parseAccessGroup({ id: 'g', name: 'n', kind: 'TEAM' })).toThrow();
  });
});

describe('parseAccessUser', () => {
  test('parses a person with no roles, groups or grants of their own', () => {
    const user = parseAccessUser({
      employeeId: 3,
      name: 'Arun Member',
      email: 'asset-member@echno.local',
      designation: null,
      active: true,
      roleIds: [],
      groupIds: [],
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
