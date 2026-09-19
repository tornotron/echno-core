import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { toolboxTalksService } from './toolbox-talks-service';

const dto = { id: '11', name: 'First record' };

afterEach(() => {
  for (const method of ['get', 'post', 'put'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('toolboxTalksService paths', () => {
  test('list reads the web twin with the paging query', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [dto], totalElements: 1 });
    const page = await toolboxTalksService.list({ page: 1, size: 20 });
    expect(api.get).toHaveBeenCalledWith('/toolbox-talks/web', { page: 1, size: 20 });
    expect(page.content[0].id).toBe('11');
  });

  test('get reads one record by id', async () => {
    spyOn(api, 'get').mockResolvedValue(dto);
    const record = await toolboxTalksService.get('11');
    expect(api.get).toHaveBeenCalledWith('/toolbox-talks/web/11');
    expect(record.name).toBe('First record');
  });

  test('create posts to the collection', async () => {
    spyOn(api, 'post').mockResolvedValue(dto);
    await toolboxTalksService.create({ name: 'First record' });
    expect(api.post).toHaveBeenCalledWith('/toolbox-talks/web', { name: 'First record' });
  });

  test('update puts to the record', async () => {
    spyOn(api, 'put').mockResolvedValue(dto);
    await toolboxTalksService.update('11', { name: 'Renamed' });
    expect(api.put).toHaveBeenCalledWith('/toolbox-talks/web/11', { name: 'Renamed' });
  });

  test('a malformed record is an ApiError, never a half-parsed object', async () => {
    spyOn(api, 'get').mockResolvedValue({ name: 'no id' });
    await expect(toolboxTalksService.get('11')).rejects.toThrow(ApiError);
  });
});
