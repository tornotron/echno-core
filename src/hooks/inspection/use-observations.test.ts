import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { observationKeys } from './keys';

/**
 * What an observation mutation refreshes, pinned by reading the source the
 * way `use-reinspections.test.ts` does (no React renderer here). The point
 * held: a review can create a defect or confirm an inspection and always
 * writes to the event log, so refreshing only the queue would leave the
 * inspection and the timeline stale.
 */
const source = readFileSync(new URL('./use-observations.ts', import.meta.url), 'utf8');

describe('observation keys', () => {
  test('nest under one namespace root', () => {
    expect(observationKeys.list({ projectId: 7 })).toEqual(['observations', 'list', { projectId: 7 }]);
    expect(observationKeys.detail('o1')).toEqual(['observations', 'detail', 'o1']);
    expect(observationKeys.evidence('o1')).toEqual(['observations', 'evidence', 'o1']);
    expect(observationKeys.detailWithRetiredRegions('o1')).toEqual([
      'observations',
      'detail',
      'o1',
      'with-retired-regions',
    ]);
  });
});

describe('observation mutations', () => {
  test('invalidate the observations, the timeline, the inspection and the NCR lists', () => {
    const start = source.indexOf('function useObservationInvalidation(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('export function', start));
    expect(body).toInclude('observationKeys.all');
    expect(body).toInclude('inspectionEventKeys.all');
    expect(body).toInclude('inspectionKeys.detail(observation.inspectionId)');
    expect(body).toInclude('inspectionKeys.detail(observation.outcomeRef)');
    expect(body).toInclude('ncrKeys.lists()');
    expect(body).toInclude('ncrKeys.detail(observation.outcomeRef)');
  });

  test('every mutation goes through that invalidation', () => {
    for (const hook of ['useCreateObservation', 'useReviewObservation']) {
      const start = source.indexOf(`export function ${hook}(`);
      expect(start).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body).toInclude('useObservationInvalidation()');
      expect(body).toInclude('onSuccess: (observation) => invalidate(observation)');
    }
  });
});

describe('bulk review mutation', () => {
  test('refreshes the observations, the timeline and the inspections', () => {
    const start = source.indexOf('export function useReviewObservationBatch(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n}\n', start));
    expect(body).toInclude('queryKey: observationKeys.all');
    expect(body).toInclude('queryKey: inspectionEventKeys.all');
    expect(body).toInclude('queryKey: inspectionKeys.all');
  });
});
