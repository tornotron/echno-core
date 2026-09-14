import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { organizationService } from './organization-service';

afterEach(() => {
  for (const m of ['get', 'put'] as const) {
    (api[m] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('organizationService dataset consent', () => {
  test('reads the flag from the per-organization endpoint', async () => {
    spyOn(api, 'get').mockResolvedValue({ organizationId: 7, datasetConsent: true });
    const flag = await organizationService.getDatasetConsent(7);
    expect(api.get).toHaveBeenCalledWith('/organization/web/7/dataset-consent');
    expect(flag).toEqual({ organizationId: 7, datasetConsent: true });
  });

  test('an absent flag reads as withdrawn, matching the backend default', async () => {
    spyOn(api, 'get').mockResolvedValue({ organizationId: 7 });
    const flag = await organizationService.getDatasetConsent(7);
    expect(flag.datasetConsent).toBe(false);
  });

  test('a body without the organization id is a parse failure, not a silent default', async () => {
    spyOn(api, 'get').mockResolvedValue({ datasetConsent: true });
    await expect(organizationService.getDatasetConsent(7)).rejects.toBeInstanceOf(ApiError);
  });

  test('records consent with the backend field name and returns what was stored', async () => {
    spyOn(api, 'put').mockResolvedValue({ organizationId: 7, datasetConsent: true });
    const flag = await organizationService.setDatasetConsent(7, { datasetConsent: true });
    expect(api.put).toHaveBeenCalledWith('/organization/web/7/dataset-consent', {
      datasetConsent: true,
    });
    expect(flag.datasetConsent).toBe(true);
  });

  test('withdrawing sends false explicitly rather than omitting the field', async () => {
    spyOn(api, 'put').mockResolvedValue({ organizationId: 7, datasetConsent: false });
    await organizationService.setDatasetConsent(7, { datasetConsent: false });
    expect(api.put).toHaveBeenCalledWith('/organization/web/7/dataset-consent', {
      datasetConsent: false,
    });
  });
});
