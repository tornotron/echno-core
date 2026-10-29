import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { accessService } from './access-service';

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('accessService.getCurrentUserAccess', () => {
  test('requests the current-user-access endpoint and parses the response', async () => {
    spyOn(api, 'get').mockResolvedValue({
      organizationId: 5,
      employeeId: 42,
      grants: { 'assets:view': ['ALL'] },
    });
    const access = await accessService.getCurrentUserAccess();
    expect(api.get).toHaveBeenCalledWith('/access/web/current-user-access');
    expect(access.grants).toEqual({ 'assets:view': ['ALL'] });
  });

  test('throws rather than reporting no access on a malformed response', async () => {
    spyOn(api, 'get').mockResolvedValue({ error: 'not access' });
    await expect(accessService.getCurrentUserAccess()).rejects.toThrow(ApiError);
  });
});

const role = {
  id: 'r-1',
  slug: 'asset-clerk',
  name: 'Asset Clerk',
  system: false,
  baseline: false,
  grants: [{ permission: 'assets:create', scope: 'ALL', locked: false }],
  memberIds: [4],
  grantableRoleIds: [],
};
const group = { id: 'g-1', name: 'Site', kind: 'DEPARTMENT', grants: [], memberIds: [3], roleIds: [] };
const user = { employeeId: 3, name: 'Arun', active: true, roleIds: ['r-1'], groupIds: [], grants: [] };

describe('accessService reads for the Roles & Permissions screen', () => {
  afterEach(() => {
    (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
  });

  test('getCatalog requests the catalog', async () => {
    spyOn(api, 'get').mockResolvedValue({ sections: ['Stores'], scopes: ['ALL'], areas: [] });
    const catalog = await accessService.getCatalog();
    expect(api.get).toHaveBeenCalledWith('/access/web/catalog');
    expect(catalog.sections).toEqual(['Stores']);
  });

  test('getRoles, getGroups and getUsers parse each row', async () => {
    const get = spyOn(api, 'get');
    get.mockResolvedValueOnce([role]).mockResolvedValueOnce([group]).mockResolvedValueOnce([user]);
    expect((await accessService.getRoles())[0].slug).toBe('asset-clerk');
    expect((await accessService.getGroups())[0].kind).toBe('DEPARTMENT');
    expect((await accessService.getUsers())[0].roleIds).toEqual(['r-1']);
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      '/access/web/roles',
      '/access/web/groups',
      '/access/web/users',
    ]);
  });

  test('throws on a list response that is not a list', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [role] });
    await expect(accessService.getRoles()).rejects.toThrow(ApiError);
  });
});

describe('accessService writes', () => {
  afterEach(() => {
    for (const m of [api.post, api.put, api.delete]) {
      (m as unknown as { mockRestore?: () => void }).mockRestore?.();
    }
  });

  test('role writes send their bodies to the role paths', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(role);
    const put = spyOn(api, 'put').mockResolvedValue(role);
    await accessService.createRole({ name: 'Asset Clerk' });
    await accessService.updateRole('r-1', { name: 'Asset Clerk', subtitle: 'Stores' });
    await accessService.setRoleGrants('r-1', [{ permission: 'assets:create', scope: 'ALL' }]);
    await accessService.setRoleGrantableRoles('r-1', ['r-2']);
    expect(post).toHaveBeenCalledWith('/access/web/roles', { name: 'Asset Clerk' });
    expect(put.mock.calls).toEqual([
      ['/access/web/roles/r-1', { name: 'Asset Clerk', subtitle: 'Stores' }],
      ['/access/web/roles/r-1/grants', { grants: [{ permission: 'assets:create', scope: 'ALL' }] }],
      ['/access/web/roles/r-1/grantable-roles', { roleIds: ['r-2'] }],
    ]);
  });

  test('group writes send their bodies to the group paths', async () => {
    const put = spyOn(api, 'put').mockResolvedValue(group);
    await accessService.setGroupMembers('g-1', [3, 4]);
    await accessService.setGroupRoles('g-1', ['r-1']);
    await accessService.setGroupGrants('g-1', []);
    expect(put.mock.calls).toEqual([
      ['/access/web/groups/g-1/members', { employeeIds: [3, 4] }],
      ['/access/web/groups/g-1/roles', { roleIds: ['r-1'] }],
      ['/access/web/groups/g-1/grants', { grants: [] }],
    ]);
  });

  test('user writes are keyed by employee id', async () => {
    const put = spyOn(api, 'put').mockResolvedValue(user);
    const updated = await accessService.setUserRoles(3, ['r-1']);
    await accessService.setUserGrants(3, [{ permission: 'wbs:edit', scope: 'OWN' }]);
    expect(updated.employeeId).toBe(3);
    expect(put.mock.calls).toEqual([
      ['/access/web/users/3/roles', { roleIds: ['r-1'] }],
      ['/access/web/users/3/grants', { grants: [{ permission: 'wbs:edit', scope: 'OWN' }] }],
    ]);
  });

  test('deletes hit the role and group paths and return nothing', async () => {
    const del = spyOn(api, 'delete').mockResolvedValue(undefined);
    await expect(accessService.deleteRole('r-1')).resolves.toBeUndefined();
    await accessService.deleteGroup('g-1');
    expect(del.mock.calls.map((c) => c[0])).toEqual(['/access/web/roles/r-1', '/access/web/groups/g-1']);
  });

  test('throws rather than returning a half-read role', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: 'r-1' });
    await expect(accessService.createRole({ name: 'x' })).rejects.toThrow(ApiError);
  });
});
