import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { WbsDependencyType } from '../types/wbs/wbs';
import { wbsService } from './wbs-service';

afterEach(() => {
  for (const method of ['get', 'post', 'put', 'delete'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('wbsService paths', () => {
  test('the schedule is one read on the web twin', async () => {
    spyOn(api, 'get').mockResolvedValue({ activities: [], dependencies: [] });
    await wbsService.getSchedule(7);
    expect(api.get).toHaveBeenCalledWith('/project/7/wbs/web/schedule');
  });

  test('create sends only the fields given', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: 1, wbsCode: '1' });
    await wbsService.createActivity(7, { wbsCode: '1', title: 'Footings', endDate: '2026-09-10', isMilestone: true });
    expect(api.post).toHaveBeenCalledWith('/project/7/wbs/web', {
      wbsCode: '1',
      title: 'Footings',
      endDate: '2026-09-10',
      isMilestone: true,
    });
  });

  test('update is a partial PUT on the element', async () => {
    spyOn(api, 'put').mockResolvedValue({ id: 5 });
    await wbsService.updateActivity(7, 5, { forecastEndDate: '2026-09-25' });
    expect(api.put).toHaveBeenCalledWith('/project/7/wbs/web/5', { forecastEndDate: '2026-09-25' });
  });

  test('links are added and removed under the project', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: 3, predecessorId: 1, successorId: 2 });
    spyOn(api, 'delete').mockResolvedValue({ message: 'removed' });
    const link = await wbsService.addDependency(7, { predecessorId: 1, successorId: 2, type: WbsDependencyType.SS });
    expect(api.post).toHaveBeenCalledWith('/project/7/wbs/web/dependencies', {
      predecessorId: 1,
      successorId: 2,
      type: 'SS',
    });
    expect(link.id).toBe(3);
    await wbsService.removeDependency(7, 3);
    expect(api.delete).toHaveBeenCalledWith('/project/7/wbs/web/dependencies/3');
  });
});
