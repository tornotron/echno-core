import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../lib/api/api-client';
import { searchService } from './search-service';

/**
 * The quick-search client.
 *
 * The point of this service is that a search box stops downloading whole
 * collections, so what matters is that it issues one bounded request for a term
 * worth running and no request at all for one that is not.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('searchService.search — terms not worth a round trip', () => {
  test.each(['', '   ', 'a', ' b '])(
    'sends nothing for %p',
    async (term: string) => {
      const get = spyOn(api, 'get').mockResolvedValue([] as Raw);

      await expect(searchService.search(term)).resolves.toEqual([]);
      expect(get).not.toHaveBeenCalled();
    }
  );
});

describe('searchService.search — the request', () => {
  test('hits the one cross-entity endpoint with the trimmed term', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([] as Raw);

    await searchService.search('  slab  ');

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toBe('/search/web');
    expect(get.mock.calls[0]?.[1]).toEqual({ q: 'slab' });
  });

  test('sends one request for all three kinds rather than one per kind', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([] as Raw);

    await searchService.search('tower');

    expect(get).toHaveBeenCalledTimes(1);
  });

  test('passes a row limit through when one is given', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([] as Raw);

    await searchService.search('tower', 5);

    expect(get.mock.calls[0]?.[1]).toEqual({ q: 'tower', limit: 5 });
  });
});

describe('searchService.search — the response', () => {
  test('carries the kind, id, title and owning project of each hit', async () => {
    spyOn(api, 'get').mockResolvedValue([
      { type: 'PROJECT', id: 1, title: 'Riverside Tower', projectId: 1 },
      { type: 'TASK', id: 8, title: 'Pour the raft slab', projectId: 1 },
      { type: 'ISSUE', id: 4, title: 'Crack in the beam', projectId: 1 },
    ] as Raw);

    const hits = await searchService.search('tower');

    expect(hits).toEqual([
      { type: 'PROJECT', id: 1, title: 'Riverside Tower', projectId: 1 },
      { type: 'TASK', id: 8, title: 'Pour the raft slab', projectId: 1 },
      { type: 'ISSUE', id: 4, title: 'Crack in the beam', projectId: 1 },
    ]);
  });

  test('reads a missing project as null rather than dropping the hit', async () => {
    spyOn(api, 'get').mockResolvedValue([
      { type: 'ISSUE', id: 4, title: 'Orphan complaint', projectId: null },
    ] as Raw);

    const hits = await searchService.search('orphan');

    expect(hits).toEqual([
      { type: 'ISSUE', id: 4, title: 'Orphan complaint', projectId: null },
    ]);
  });

  test('skips a malformed row and keeps the rest', async () => {
    // A search box that goes blank because one row was odd is worse than one
    // that shows the others.
    spyOn(api, 'get').mockResolvedValue([
      { type: 'TASK', id: 8, title: 'Pour the raft slab', projectId: 1 },
      { type: 'GHOST', id: 9, title: 'Not a kind we know', projectId: 1 },
      { type: 'ISSUE', id: 'four', title: 'Bad id', projectId: 1 },
      { type: 'PROJECT', id: 2, projectId: 2 },
    ] as Raw);

    const hits = await searchService.search('slab');

    expect(hits.map((hit) => hit.id)).toEqual([8]);
  });

  test('returns an empty list when the body is not an array', async () => {
    spyOn(api, 'get').mockResolvedValue({ oops: true } as Raw);

    await expect(searchService.search('slab')).resolves.toEqual([]);
  });
});
