import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { accessService } from './access-service';

const restore = (fn: unknown) => (fn as { mockRestore?: () => void }).mockRestore?.();

afterEach(() => {
  restore(api.get);
  restore(api.post);
  restore(api.put);
  restore(api.delete);
});

describe('accessService.getCurrentUserAccess', () => {
  test('requests the current-user-access endpoint and parses the response', async () => {
    spyOn(api, 'get').mockResolvedValue({
      organizationId: 5,
      employeeId: 42,
      grants: { 'assets:read': ['ALL'] },
      projectGrants: { '7': { 'finance:read': ['ALL'] } },
    });
    const access = await accessService.getCurrentUserAccess();
    expect(api.get).toHaveBeenCalledWith('/access/web/current-user-access');
    expect(access.grants).toEqual({ 'assets:read': ['ALL'] });
    expect(access.projectGrants).toEqual({ 7: { 'finance:read': ['ALL'] } });
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
  carriedOver: false,
  organizationWideOnly: false,
  grants: [{ permission: 'assets:create', scope: 'ALL' }],
  assignments: [{ employeeId: 4, projectId: null }],
  grantableRoleIds: [],
};
const user = {
  employeeId: 3,
  name: 'Arun',
  email: 'arun@example.com',
  active: true,
  roles: [{ roleId: 'r-1', projectId: null }],
  grants: [],
};

describe('accessService reads for the Roles & Permissions screen', () => {
  test('getCatalog requests the catalog', async () => {
    spyOn(api, 'get').mockResolvedValue({ sections: ['Stores'], scopes: ['ALL'], areas: [] });
    const catalog = await accessService.getCatalog();
    expect(api.get).toHaveBeenCalledWith('/access/web/catalog');
    expect(catalog.sections).toEqual(['Stores']);
  });

  test('getRoles and getUsers parse each row', async () => {
    const get = spyOn(api, 'get');
    get.mockResolvedValueOnce([role]).mockResolvedValueOnce([user]);
    expect((await accessService.getRoles())[0].memberIds).toEqual([4]);
    expect((await accessService.getUsers())[0].roleIds).toEqual(['r-1']);
    expect(get.mock.calls.map((c) => c[0])).toEqual(['/access/web/roles', '/access/web/users']);
  });

  test('getRole and getUser read one row each', async () => {
    const get = spyOn(api, 'get');
    get.mockResolvedValueOnce(role).mockResolvedValueOnce(user);
    expect((await accessService.getRole('r-1')).slug).toBe('asset-clerk');
    expect((await accessService.getUser(3)).name).toBe('Arun');
    expect(get.mock.calls.map((c) => c[0])).toEqual(['/access/web/roles/r-1', '/access/web/users/3']);
  });

  test('throws on a list response that is not a list', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [role] });
    await expect(accessService.getRoles()).rejects.toThrow(ApiError);
  });
});

describe('accessService writes for the Roles & Permissions screen', () => {
  test('createRole posts the request and parses the id and slug', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: 'r-9', slug: 'site-lead' });
    const created = await accessService.createRole({ name: 'Site Lead', subtitle: 'Execution' });
    expect(api.post).toHaveBeenCalledWith('/access/web/roles', { name: 'Site Lead', subtitle: 'Execution' });
    expect(created).toEqual({ id: 'r-9', slug: 'site-lead' });
  });

  test('createRole throws when the created role cannot be read', async () => {
    spyOn(api, 'post').mockResolvedValue(undefined);
    await expect(accessService.createRole({ name: 'Site Lead' })).rejects.toThrow(ApiError);
  });

  test('each replace sends the whole set under the field the backend names', async () => {
    const put = spyOn(api, 'put').mockResolvedValue(undefined);
    await accessService.updateRole('r-1', { name: 'Asset Lead' });
    await accessService.setRoleGrants('r-1', [{ permission: 'assets:edit', scope: 'ALL' }]);
    await accessService.setRoleGrantableRoles('r-1', ['r-2']);
    await accessService.setUserRoles(3, [{ roleId: 'r-1', projectId: 11 }, { roleId: 'r-2' }]);
    expect(put.mock.calls).toEqual([
      ['/access/web/roles/r-1', { name: 'Asset Lead' }],
      ['/access/web/roles/r-1/grants', { grants: [{ permission: 'assets:edit', scope: 'ALL' }] }],
      ['/access/web/roles/r-1/grantable-roles', { roleIds: ['r-2'] }],
      ['/access/web/users/3/roles', { roles: [{ roleId: 'r-1', projectId: 11 }, { roleId: 'r-2' }] }],
    ]);
  });

  test('deleteRole deletes by id', async () => {
    spyOn(api, 'delete').mockResolvedValue(undefined);
    await accessService.deleteRole('r-1');
    expect(api.delete).toHaveBeenCalledWith('/access/web/roles/r-1');
  });

  test('offers the Roles and Users reads and writes, and nothing for groups', () => {
    expect(Object.keys(accessService).sort()).toEqual([
      'createRole',
      'deleteRole',
      'getCatalog',
      'getCurrentUserAccess',
      'getRole',
      'getRoles',
      'getUser',
      'getUsers',
      'setRoleGrantableRoles',
      'setRoleGrants',
      'setUserRoles',
      'updateRole',
    ]);
  });
});
