import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import type { RiskRequest } from '../types/risk/risk';
import { riskService } from './risk-service';

const ID = '4f1c0d6e-2b7a-4c55-9d38-1a2b3c4d5e6f';
const REQUEST: RiskRequest = {
  title: 'Late drawings',
  category: 'design-engineering',
  status: 'identified',
  probability: 'medium',
  impact: 'major',
  residualProbability: 'low',
  residualImpact: 'minor',
  responseType: 'mitigate',
};

afterEach(() => {
  for (const method of ['get', 'post', 'put', 'delete'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('riskService paths', () => {
  test('list reads the web twin of the project register', async () => {
    spyOn(api, 'get').mockResolvedValue([{ id: ID, riskNumber: 1 }]);
    const risks = await riskService.list(42);
    expect(api.get).toHaveBeenCalledWith('/project/42/risks/web');
    expect(risks[0].riskId).toBe('R-001');
  });

  test('create posts the request', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: ID, riskNumber: 1 });
    await riskService.create(42, REQUEST);
    expect(api.post).toHaveBeenCalledWith('/project/42/risks/web', { ...REQUEST });
  });

  test('import wraps the lines in a risks field', async () => {
    spyOn(api, 'post').mockResolvedValue([]);
    await riskService.importRisks(42, [{ ...REQUEST, importRef: 'local-1' }]);
    expect(api.post).toHaveBeenCalledWith('/project/42/risks/web/import', {
      risks: [{ ...REQUEST, importRef: 'local-1' }],
    });
  });

  test('update puts to the risk and carries the version', async () => {
    spyOn(api, 'put').mockResolvedValue({ id: ID, riskNumber: 1, version: 4 });
    await riskService.update(42, ID, { ...REQUEST, version: 3 });
    expect(api.put).toHaveBeenCalledWith(`/project/42/risks/web/${ID}`, { ...REQUEST, version: 3 });
  });

  test('delete removes the risk', async () => {
    spyOn(api, 'delete').mockResolvedValue(undefined);
    await riskService.delete(42, ID);
    expect(api.delete).toHaveBeenCalledWith(`/project/42/risks/web/${ID}`);
  });

  test('a list that is not an array is an ApiError, not a crash', async () => {
    spyOn(api, 'get').mockResolvedValue({ not: 'an array' });
    await expect(riskService.list(42)).rejects.toBeInstanceOf(ApiError);
  });
});
