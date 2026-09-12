import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { api } from '../lib/api/api-client';
import { spatialService } from './spatial-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const NODE = '9d4f3c1e-0d4e-4f5a-9b2c-1d2e3f4a5b6f';
const node = { id: NODE, level: 'ELEMENT', code: 'C4', name: 'C4', spatialPath: [] };

/** Write routes the backend publishes, as `bun run contract:refresh` reduced them. */
const published: Set<string> = new Set(
  Object.keys(
    JSON.parse(
      fs.readFileSync(
        path.resolve(import.meta.dir, '..', '..', 'etc', 'backend-request-fields.json'),
        'utf8'
      )
    ).operations
  )
);

function route(method: string, called: string): string {
  return `${method} /api/v1${called}`
    .replace(/\/\d+(?=\/|$)/g, '/{projectId}')
    .replace(new RegExp(`/${NODE}`, 'g'), '/{nodeId}');
}

const spies: Array<{ mockRestore: () => void }> = [];
afterEach(() => {
  spies.splice(0).forEach((s) => s.mockRestore());
});

describe('spatial service calls the routes the backend publishes', () => {
  test('reads go to /project/{projectId}/spatial', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([] as Raw);
    spies.push(get);
    await spatialService.getTree(12);
    expect(get.mock.calls[0]?.[0]).toBe('/project/12/spatial');
    expect(get.mock.calls[0]?.[1]).toEqual({});

    await spatialService.getTree(12, true);
    expect(get.mock.calls[1]?.[1]).toEqual({ includeArchived: true });

    get.mockResolvedValue(node as Raw);
    await spatialService.getNode(12, NODE);
    expect(get.mock.calls[2]?.[0]).toBe(`/project/12/spatial/nodes/${NODE}`);
  });

  test('every write route exists in the OpenAPI snapshot', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(node as Raw);
    const patch = spyOn(api, 'patch').mockResolvedValue(node as Raw);
    spies.push(post, patch);

    await spatialService.createNode(12, { level: 'BUILDING', code: 'B1', name: 'B1' });
    await spatialService.moveNode(12, NODE, { parentId: NODE });
    await spatialService.archiveNode(12, NODE);
    await spatialService.restoreNode(12, NODE);
    post.mockResolvedValue({ created: 1, skipped: 0 } as Raw);
    await spatialService.importRows(12, { rows: [{ building: 'B1' }] });
    await spatialService.updateNode(12, NODE, { name: 'Block B' });

    const called = [
      ...post.mock.calls.map((c) => route('POST', c[0] as string)),
      ...patch.mock.calls.map((c) => route('PATCH', c[0] as string)),
    ];
    expect(called).toEqual([
      'POST /api/v1/project/{projectId}/spatial/nodes',
      'POST /api/v1/project/{projectId}/spatial/nodes/{nodeId}/move',
      'POST /api/v1/project/{projectId}/spatial/nodes/{nodeId}/archive',
      'POST /api/v1/project/{projectId}/spatial/nodes/{nodeId}/restore',
      'POST /api/v1/project/{projectId}/spatial/import',
      'PATCH /api/v1/project/{projectId}/spatial/nodes/{nodeId}',
    ]);
    for (const r of called) expect(published.has(r)).toBe(true);
  });

  test('a tree that is not an array is a failed parse, not zero nodes', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({ nodes: [] } as Raw);
    spies.push(get);
    await expect(spatialService.getTree(12)).rejects.toThrow();
  });
});
