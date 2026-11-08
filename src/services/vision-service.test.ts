import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { visionService } from './vision-service';

const model = {
  key: 'ppe',
  name: 'PPE',
  task: 'DETECT',
  family: 'SAFETY',
  versions: [{ id: 'v1', modelKey: 'ppe', version: '0.1.0', status: 'ACTIVE', classes: [] }],
};

afterEach(() => {
  for (const method of ['get', 'post', 'put'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('visionService', () => {
  test('listModels reads the registry, which has no web twin', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([model]);
    const models = await visionService.listModels();
    expect(get).toHaveBeenCalledWith('/vision/models');
    expect(models[0]?.versions[0]?.version).toBe('0.1.0');
  });

  test('listModels refuses a body that is not a list', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [model] });
    await expect(visionService.listModels()).rejects.toThrow(ApiError);
  });

  test('getModelVersion encodes the key and version into the path', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(model.versions[0]);
    const version = await visionService.getModelVersion('ppe', '0.1.0+rc/1');
    expect(get).toHaveBeenCalledWith('/vision/models/ppe/versions/0.1.0%2Brc%2F1');
    expect(version.id).toBe('v1');
  });

  test('getSettings reads the web twin', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      autoInfer: true,
      modelKeys: ['ppe'],
      updatedById: 4,
      updatedAt: '2026-11-08T10:00:00',
    });
    const settings = await visionService.getSettings();
    expect(get).toHaveBeenCalledWith('/vision/web/settings');
    expect(settings.autoInfer).toBe(true);
  });

  test('updateSettings puts the whole settings', async () => {
    const put = spyOn(api, 'put').mockResolvedValue({ autoInfer: false, modelKeys: [] });
    const settings = await visionService.updateSettings({ autoInfer: false, modelKeys: [] });
    expect(put).toHaveBeenCalledWith('/vision/web/settings', { autoInfer: false, modelKeys: [] });
    expect(settings).toEqual({ autoInfer: false, modelKeys: [], updatedById: null, updatedAt: null });
  });

  test('queueRun posts one source and returns the counts', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({
      queued: 2,
      skippedDuplicate: 1,
      skippedNotImage: 0,
    });
    const result = await visionService.queueRun({ attachmentIds: [1, 2, 3] });
    expect(post).toHaveBeenCalledWith('/vision/web/runs', { attachmentIds: [1, 2, 3] });
    expect(result).toEqual({ queued: 2, skippedDuplicate: 1, skippedNotImage: 0 });
  });

  test('queueRun with two sources sends nothing', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({});
    await expect(
      visionService.queueRun({ inspectionId: 'i1', attachmentIds: [1] })
    ).rejects.toThrow(TypeError);
    expect(post).not.toHaveBeenCalled();
  });

  test('a switched-off module surfaces as the 404 ApiError', async () => {
    spyOn(api, 'get').mockRejectedValue(new ApiError('Not found', 404));
    await expect(visionService.getSettings()).rejects.toMatchObject({ status: 404 });
  });
});
