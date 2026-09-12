import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { moduleService } from './module-service';

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

const inspectionsDto = {
  id: 'inspections',
  name: 'Inspections',
  version: '1.4.0',
  entitlementFeatureKey: 'MODULE_INSPECTIONS',
  enabled: true,
  entitled: true,
  nav: [],
  permissions: ['inspections:view'],
};

describe('moduleService.listEnabled', () => {
  test('requests the enabled-modules endpoint and parses the response', async () => {
    spyOn(api, 'get').mockResolvedValue([inspectionsDto]);
    const modules = await moduleService.listEnabled();
    expect(api.get).toHaveBeenCalledWith('/modules/web/enabled');
    expect(modules).toHaveLength(1);
    expect(modules[0].id).toBe('inspections');
  });

  test('throws rather than silently reporting zero modules on a malformed response', async () => {
    spyOn(api, 'get').mockResolvedValue({ error: 'not an array' });
    await expect(moduleService.listEnabled()).rejects.toThrow(ApiError);
  });
});

describe('moduleService.listInstalled', () => {
  test('requests the full registry endpoint', async () => {
    spyOn(api, 'get').mockResolvedValue([inspectionsDto]);
    const modules = await moduleService.listInstalled();
    expect(api.get).toHaveBeenCalledWith('/modules/web');
    expect(modules).toHaveLength(1);
  });
});
