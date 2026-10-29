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
