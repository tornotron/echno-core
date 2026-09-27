import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { DelayReason, ProgressOutcome } from '../types/work-progress/work-progress';
import { workProgressService } from './work-progress-service';

const ID = 'b5a1c3d2-8e4f-4a6b-9c7d-0e1f2a3b4c5d';

afterEach(() => {
  for (const method of ['get', 'post'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('workProgressService paths', () => {
  test('list reads the web twin with the filters given', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [] });
    await workProgressService.list({ projectId: 7, wbsElementId: 42, pageNo: 0, pageSize: 20 });
    expect(api.get).toHaveBeenCalledWith('/progress-inspections/web', {
      projectId: 7,
      wbsElementId: 42,
      pageNo: 0,
      pageSize: 20,
    });
  });

  test('record posts only the fields given', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: ID, outcome: 'NOT_DONE' });
    await workProgressService.record({
      wbsElementId: 42,
      inspectionDate: '2026-09-19',
      outcome: ProgressOutcome.NOT_DONE,
      forecastFinishDate: '2026-09-25',
      delayReason: DelayReason.MATERIAL,
    });
    expect(api.post).toHaveBeenCalledWith('/progress-inspections/web', {
      wbsElementId: 42,
      inspectionDate: '2026-09-19',
      outcome: 'NOT_DONE',
      forecastFinishDate: '2026-09-25',
      delayReason: 'MATERIAL',
    });
  });

  test('evidence goes through presign and register on the record', async () => {
    spyOn(api, 'post').mockResolvedValue([]);
    await workProgressService.presignEvidence(ID, []);
    expect(api.post).toHaveBeenCalledWith(`/progress-inspections/web/${ID}/evidence/presign`, []);
    await workProgressService.registerEvidence(ID, []);
    expect(api.post).toHaveBeenCalledWith(`/progress-inspections/web/${ID}/evidence/register`, []);
  });

  test('a malformed evidence payload is an ApiError, not a crash', async () => {
    spyOn(api, 'get').mockResolvedValue({ not: 'an array' });
    await expect(workProgressService.getEvidence(ID)).rejects.toBeInstanceOf(ApiError);
  });
});
