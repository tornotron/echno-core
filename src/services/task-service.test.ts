import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../lib/api/api-client';
import { taskService } from './task-service';

/**
 * The read paths of the task service, and specifically the one that used to be
 * wrong.
 *
 * `getAll()` hits a listing that paged at ten by default and threw the page
 * envelope away, so it returned the ten lowest-id tasks in the tenant. The
 * per-project view then filtered those ten in the browser, which meant a
 * project whose tasks were not among them rendered as having no tasks at all.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/** A raw task DTO as the backend sends it. */
function rawTask(id: number, projectId: number): Raw {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    projectId,
    status: 'onGoing',
    progress: 0,
  };
}

afterEach(() => {
  // spyOn installs on the shared api object; restore so tests stay independent.
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('taskService.getByProjectId', () => {
  test("asks the backend for the project's tasks instead of the tenant's", async () => {
    const get = spyOn(api, 'get').mockResolvedValue([] as Raw);

    await taskService.getByProjectId(7);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toBe('/tasks/web/projectId/7');
  });

  test('never falls back to reading the whole task list', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([] as Raw);

    await taskService.getByProjectId(7);

    const paths = get.mock.calls.map((call) => call[0]);
    expect(paths).not.toContain('/tasks/web');
  });

  test('returns tasks whose ids sit far outside the first ten of the tenant', async () => {
    // The regression in one line: project 7's tasks are ids 900-903, so they
    // were never in the ten rows the old client-side filter ran over.
    const serverRows = [900, 901, 902, 903].map((id) => rawTask(id, 7));
    spyOn(api, 'get').mockResolvedValue(serverRows as Raw);

    const tasks = await taskService.getByProjectId(7);

    expect(tasks.map((task) => task.id)).toEqual([900, 901, 902, 903]);
  });

  test('returns an empty list rather than throwing when the project has none', async () => {
    spyOn(api, 'get').mockResolvedValue([] as Raw);

    await expect(taskService.getByProjectId(7)).resolves.toEqual([]);
  });
});

describe('taskService.getPage', () => {
  test('requests the paginated endpoint and maps the paging parameters', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
    } as Raw);

    await taskService.getPage({ page: 2, size: 20 });

    expect(get.mock.calls[0]?.[0]).toBe('/tasks/web/paginated');
    expect(get.mock.calls[0]?.[1]).toEqual({ pageNo: 2, pageSize: 20 });
  });

  test('passes the project and search filters through to the server', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({ content: [] } as Raw);

    await taskService.getPage({ projectId: 7, search: 'slab' });

    expect(get.mock.calls[0]?.[1]).toEqual({ projectId: 7, search: 'slab' });
  });

  test('keeps the page metadata a caller needs to tell truncation from completeness', async () => {
    spyOn(api, 'get').mockResolvedValue({
      content: [rawTask(900, 7)],
      totalElements: 137,
      totalPages: 7,
      number: 3,
      size: 20,
    } as Raw);

    const page = await taskService.getPage({ page: 3, size: 20 });

    expect(page.totalElements).toBe(137);
    expect(page.totalPages).toBe(7);
    expect(page.number).toBe(3);
    expect(page.content.map((task) => task.id)).toEqual([900]);
  });

  test('survives a page envelope with fields missing', async () => {
    spyOn(api, 'get').mockResolvedValue({} as Raw);

    const page = await taskService.getPage({ size: 20 });

    expect(page.content).toEqual([]);
    expect(page.totalElements).toBe(0);
    expect(page.size).toBe(20);
  });
});
