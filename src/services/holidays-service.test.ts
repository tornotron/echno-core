import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { holidaysService } from './holidays-service';

const dto = {
  id: 11,
  organizationId: 2,
  holidayDate: '2026-10-02',
  name: 'Gandhi Jayanti',
};

afterEach(() => {
  for (const method of ['get', 'post', 'put', 'delete'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('holidaysService paths', () => {
  test('listForYear reads the web twin with the year query', async () => {
    spyOn(api, 'get').mockResolvedValue([dto]);
    const holidays = await holidaysService.listForYear(2026);
    expect(api.get).toHaveBeenCalledWith('/holidays/web', { year: 2026 });
    expect(holidays[0].name).toBe('Gandhi Jayanti');
  });

  test('get reads one holiday by query id', async () => {
    spyOn(api, 'get').mockResolvedValue(dto);
    await holidaysService.get(11);
    expect(api.get).toHaveBeenCalledWith('/holidays/web/holiday', { holidayId: 11 });
  });

  test('create posts the request body', async () => {
    spyOn(api, 'post').mockResolvedValue(dto);
    await holidaysService.create({ holidayDate: '2026-10-02', name: 'Gandhi Jayanti' });
    expect(api.post).toHaveBeenCalledWith('/holidays/web', {
      holidayDate: '2026-10-02',
      name: 'Gandhi Jayanti',
    });
  });

  test('update puts by query id and remove deletes by query id', async () => {
    spyOn(api, 'put').mockResolvedValue(dto);
    spyOn(api, 'delete').mockResolvedValue(undefined);
    await holidaysService.update(11, { holidayDate: '2026-10-02', name: 'X' });
    expect(api.put).toHaveBeenCalledWith(
      '/holidays/web/update',
      { holidayDate: '2026-10-02', name: 'X' },
      { holidayId: 11 }
    );
    await holidaysService.remove(11);
    expect(api.delete).toHaveBeenCalledWith('/holidays/web/delete', { holidayId: 11 });
  });

  test('working week reads and writes the setting', async () => {
    spyOn(api, 'get').mockResolvedValue({ organizationId: 2, workingDays: ['MONDAY'] });
    spyOn(api, 'put').mockResolvedValue({ organizationId: 2, workingDays: ['MONDAY', 'SATURDAY'] });
    expect((await holidaysService.getWorkingWeek()).workingDays).toEqual(['MONDAY']);
    const week = await holidaysService.updateWorkingWeek({ workingDays: ['SATURDAY', 'MONDAY'] });
    expect(api.put).toHaveBeenCalledWith('/holidays/web/working-week', {
      workingDays: ['SATURDAY', 'MONDAY'],
    });
    expect(week.workingDays).toEqual(['MONDAY', 'SATURDAY']);
  });

  test('a malformed holiday is an ApiError, never a half-parsed object', async () => {
    spyOn(api, 'get').mockResolvedValue({ name: 'no id' });
    await expect(holidaysService.get(11)).rejects.toThrow(ApiError);
  });
});
