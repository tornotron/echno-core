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
const user = { employeeId: 3, name: 'Arun', active: true, roleIds: ['r-1'], grants: [] };

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
    expect((await accessService.getRoles())[0].slug).toBe('asset-clerk');
    expect((await accessService.getUsers())[0].roleIds).toEqual(['r-1']);
    expect(get.mock.calls.map((c) => c[0])).toEqual(['/access/web/roles', '/access/web/users']);
  });

  test('throws on a list response that is not a list', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [role] });
    await expect(accessService.getRoles()).rejects.toThrow(ApiError);
  });

  test('offers reads only, no writes and nothing for groups', () => {
    expect(Object.keys(accessService).sort()).toEqual([
      'getCatalog',
      'getCurrentUserAccess',
      'getRoles',
      'getUsers',
    ]);
  });
});
