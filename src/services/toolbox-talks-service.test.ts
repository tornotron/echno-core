import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { ToolboxTalkStatus } from '../types/toolbox-talks/toolbox-talks';
import { toolboxTalksService } from './toolbox-talks-service';

const TALK = 'b5a1c3d2-8e4f-4a6b-9c7d-0e1f2a3b4c5d';
const dto = { id: TALK, topic: 'Working at height', status: 'DRAFT' };

afterEach(() => {
  for (const method of ['get', 'post', 'put', 'delete', 'getBlob'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('toolboxTalksService paths', () => {
  test('list reads the web twin with every filter and the paging query', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [dto], totalElements: 1 });
    const page = await toolboxTalksService.list({
      projectId: 7,
      from: '2026-09-01',
      to: '2026-09-30',
      status: ToolboxTalkStatus.RECORDED,
      pageNo: 1,
      pageSize: 20,
    });
    expect(api.get).toHaveBeenCalledWith('/toolbox-talks/web', {
      projectId: 7,
      from: '2026-09-01',
      to: '2026-09-30',
      status: 'RECORDED',
      pageNo: 1,
      pageSize: 20,
    });
    expect(page.content[0].id).toBe(TALK);
  });

  test('list omits filters that were not given', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [] });
    await toolboxTalksService.list();
    expect(api.get).toHaveBeenCalledWith('/toolbox-talks/web', {});
  });

  test('get reads one talk by id', async () => {
    spyOn(api, 'get').mockResolvedValue(dto);
    const talk = await toolboxTalksService.get(TALK);
    expect(api.get).toHaveBeenCalledWith(`/toolbox-talks/web/${TALK}`);
    expect(talk.topic).toBe('Working at height');
  });

  test('create posts the draft to the collection', async () => {
    spyOn(api, 'post').mockResolvedValue(dto);
    const body = {
      projectId: 7,
      topic: 'Working at height',
      talkDate: '2026-09-19',
      conductorEmployeeId: 12,
      attendeeEmployeeIds: [21],
    };
    await toolboxTalksService.create(body);
    expect(api.post).toHaveBeenCalledWith('/toolbox-talks/web', body);
  });

  test('update puts the draft', async () => {
    spyOn(api, 'put').mockResolvedValue(dto);
    const body = { topic: 'Renamed', talkDate: '2026-09-19', conductorEmployeeId: 12 };
    await toolboxTalksService.update(TALK, body);
    expect(api.put).toHaveBeenCalledWith(`/toolbox-talks/web/${TALK}`, body);
  });

  test('attendees are added as a batch and removed one at a time', async () => {
    spyOn(api, 'post').mockResolvedValue(dto);
    spyOn(api, 'delete').mockResolvedValue(dto);
    await toolboxTalksService.addAttendees(TALK, { employeeIds: [21, 22] });
    expect(api.post).toHaveBeenCalledWith(`/toolbox-talks/web/${TALK}/attendees`, {
      employeeIds: [21, 22],
    });
    await toolboxTalksService.removeAttendee(TALK, 21);
    expect(api.delete).toHaveBeenCalledWith(`/toolbox-talks/web/${TALK}/attendees/21`);
  });

  test('record posts to the record action with no body', async () => {
    spyOn(api, 'post').mockResolvedValue({ ...dto, status: 'RECORDED' });
    const talk = await toolboxTalksService.record(TALK);
    expect(api.post).toHaveBeenCalledWith(`/toolbox-talks/web/${TALK}/record`);
    expect(talk.status).toBe(ToolboxTalkStatus.RECORDED);
  });

  test('photos presign and register on the talk, and list back', async () => {
    spyOn(api, 'post')
      .mockResolvedValueOnce([{ key: 'k1', url: 'https://s/k1', contentType: 'image/png' }])
      .mockResolvedValueOnce([{ id: 5, fileName: 'a.png', url: 'https://s/k1' }]);
    spyOn(api, 'get').mockResolvedValue([{ id: 5, fileName: 'a.png', url: 'https://s/k1' }]);

    const slots = await toolboxTalksService.presignPhotos(TALK, [
      { filename: 'a.png', contentType: 'image/png', fileSize: 10 },
    ]);
    expect(api.post).toHaveBeenNthCalledWith(1, `/toolbox-talks/web/${TALK}/photos/presign`, [
      { filename: 'a.png', contentType: 'image/png', fileSize: 10 },
    ]);
    expect(slots[0].key).toBe('k1');

    const registered = await toolboxTalksService.registerPhotos(TALK, [{ key: 'k1', filename: 'a.png', contentType: 'image/png', fileSize: 10 }]);
    expect(api.post).toHaveBeenNthCalledWith(2, `/toolbox-talks/web/${TALK}/photos/register`, [
      { key: 'k1', filename: 'a.png', contentType: 'image/png', fileSize: 10 },
    ]);
    expect(registered).toHaveLength(1);

    const photos = await toolboxTalksService.getPhotos(TALK);
    expect(api.get).toHaveBeenCalledWith(`/toolbox-talks/web/${TALK}/photos`);
    expect(photos).toHaveLength(1);
  });

  test('the pdf is fetched as a blob from the record path', async () => {
    const blob = new Blob(['%PDF']);
    spyOn(api, 'getBlob').mockResolvedValue(blob);
    await expect(toolboxTalksService.downloadPdf(TALK)).resolves.toBe(blob);
    expect(api.getBlob).toHaveBeenCalledWith(`/toolbox-talks/web/${TALK}/pdf`);
    expect(toolboxTalksService.pdfPath(TALK)).toBe(`/toolbox-talks/web/${TALK}/pdf`);
  });

  test('a photo list that is not an array is an ApiError', async () => {
    spyOn(api, 'get').mockResolvedValue({ message: 'not a list' });
    await expect(toolboxTalksService.getPhotos(TALK)).rejects.toThrow(ApiError);
    spyOn(api, 'post').mockResolvedValue([{ url: 'https://s/k1' }]);
    await expect(
      toolboxTalksService.presignPhotos(TALK, [
        { filename: 'a.png', contentType: 'image/png', fileSize: 10 },
      ])
    ).rejects.toThrow(ApiError);
  });

  test('a malformed talk is an ApiError, never a half-parsed object', async () => {
    spyOn(api, 'get').mockResolvedValue({ topic: 'no id' });
    await expect(toolboxTalksService.get(TALK)).rejects.toThrow(ApiError);
  });
});
