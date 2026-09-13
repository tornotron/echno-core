/**
 * The BIM client (core #115). Fails without the code: `bim-service` does not
 * exist on `development`.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../lib/api/api-client';
import { bimJobRefetchInterval } from '../hooks/bim/use-bim';
import { bimKeys } from '../hooks/bim/keys';
import { bimService } from './bim-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const MODEL = '11111111-1111-1111-1111-111111111111';
const V1 = '22222222-2222-2222-2222-222222222222';
const JOB = '44444444-4444-4444-4444-444444444444';
const EL = '55555555-5555-5555-5555-555555555555';

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
  (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('bimService', () => {
  test('lists a project\'s models on the single /bim surface', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([{ id: MODEL, name: 'Tower A', projectId: 7 }]);
    const models = await bimService.listModels(7);
    expect(get).toHaveBeenCalledWith('/bim/projects/7/models');
    expect(models[0].name).toBe('Tower A');
  });

  test('presign posts filename and size, then register and enqueue hit the version', async () => {
    const post = spyOn(api, 'post')
      .mockResolvedValueOnce({
        versionId: V1,
        versionNumber: 1,
        upload: { key: 'k', url: 'https://store/put', contentType: 'application/x-step', expiresInSeconds: 900 },
      })
      .mockResolvedValueOnce({ id: V1, modelId: MODEL, status: 'UPLOADED' })
      .mockResolvedValueOnce({ id: JOB, modelId: MODEL, versionId: V1, status: 'QUEUED' });
    const slot = await bimService.presignSource(MODEL, { filename: 'tower.ifc', fileSize: 1234 });
    expect(post).toHaveBeenNthCalledWith(1, `/bim/models/${MODEL}/versions/presign`, {
      filename: 'tower.ifc',
      fileSize: 1234,
    });
    expect(slot.upload.url).toBe('https://store/put');
    const version = await bimService.registerSource(MODEL, V1);
    expect(post).toHaveBeenNthCalledWith(2, `/bim/models/${MODEL}/versions/${V1}/register`);
    expect(version.status).toBe('UPLOADED');
    const job = await bimService.enqueueImport(MODEL, V1);
    expect(post).toHaveBeenNthCalledWith(3, `/bim/models/${MODEL}/versions/${V1}/jobs`);
    expect(job.status).toBe('QUEUED');
  });

  test('elements are paged per storey with the query the backend documents', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      content: [{ id: EL, globalId: 'G1', storeyGlobalId: 'S0' }],
      page: 0, size: 200, totalElements: 1, totalPages: 1,
    });
    const page = await bimService.listElements(MODEL, { storeyGlobalId: 'S0', page: 0, size: 200 });
    expect(get).toHaveBeenCalledWith(`/bim/models/${MODEL}/elements`, {
      storeyGlobalId: 'S0', page: 0, size: 200,
    });
    expect(page.content[0].globalId).toBe('G1');
  });

  test('a GlobalId lookup walks the pages until it finds the row, or gives up', async () => {
    const get = spyOn(api, 'get')
      .mockResolvedValueOnce({ content: [{ id: EL, globalId: 'A' }], page: 0, totalPages: 2 })
      .mockResolvedValueOnce({ content: [{ id: EL, globalId: 'B' }], page: 1, totalPages: 2 });
    const hit = await bimService.findElementByGlobalId(MODEL, 'B', 'S0');
    expect(hit?.globalId).toBe('B');
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1]).toMatchObject({ storeyGlobalId: 'S0', includeRetired: true, page: 1 });

    get.mockReset();
    get.mockResolvedValueOnce({ content: [{ id: EL, globalId: 'A' }], page: 0, totalPages: 1 });
    expect(await bimService.findElementByGlobalId(MODEL, 'Z')).toBeUndefined();
  });

  test('tiles come from the version, presigned', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      modelId: MODEL, versionId: V1, expiresInSeconds: 600,
      storeys: [{ globalId: 'S0', url: 'https://store/S0.glb?sig' }],
    });
    const m = await bimService.getTiles(MODEL, V1);
    expect(get).toHaveBeenCalledWith(`/bim/models/${MODEL}/versions/${V1}/tiles`);
    expect(m.storeys[0].url).toContain('?sig');
  });

  test('confirm posts the hierarchy request and returns the proposal with its result', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({
      versionId: V1,
      confirmation: { nodesCreated: 4, nodesMatched: 0, elementsLinked: 10, elementsSkipped: 1 },
    });
    const p = await bimService.confirmHierarchy(MODEL, V1, { includeElements: true });
    expect(post).toHaveBeenCalledWith(
      `/bim/models/${MODEL}/versions/${V1}/hierarchy/confirm`,
      { includeElements: true }
    );
    expect(p.confirmation?.elementsLinked).toBe(10);
  });

  test('an unparseable body surfaces as a 422 ApiError', async () => {
    spyOn(api, 'get').mockResolvedValue({ name: 'no id' });
    await expect(bimService.getModel(MODEL)).rejects.toMatchObject({ status: 422 });
  });
});

describe('job polling', () => {
  test('polls while QUEUED or RUNNING and stops at DONE or FAILED', () => {
    const base = { id: JOB, modelId: MODEL, versionId: V1, attempt: 1, maxAttempts: 3 };
    expect(bimJobRefetchInterval({ ...base, status: 'QUEUED' })).toBe(3000);
    expect(bimJobRefetchInterval({ ...base, status: 'RUNNING' }, 1000)).toBe(1000);
    expect(bimJobRefetchInterval({ ...base, status: 'DONE' })).toBe(false);
    expect(bimJobRefetchInterval({ ...base, status: 'FAILED' })).toBe(false);
    expect(bimJobRefetchInterval(undefined)).toBe(false);
  });

  test('keys nest under the model so one invalidation refreshes versions, tiles and elements', () => {
    expect(bimKeys.tiles(MODEL, V1).slice(0, 3)).toEqual(bimKeys.model(MODEL));
    expect(bimKeys.elements(MODEL, { storeyGlobalId: 'S0' }).slice(0, 3)).toEqual(bimKeys.model(MODEL));
    expect(bimKeys.job(JOB)).toEqual(['bim', 'job', JOB]);
  });
});
