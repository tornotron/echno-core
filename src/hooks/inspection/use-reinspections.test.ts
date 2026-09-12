import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { inspectionEventKeys, inspectionKeys, ncrKeys, reinspectionKeys } from './keys';

/**
 * What a reinspection mutation refreshes. This package has no React test
 * renderer, so the invalidation is pinned by reading the source, the way
 * `hooks/movement/use-verify-movement.test.ts` does. The point being held:
 * an outcome moves the NCR and writes to the event log, so refreshing only
 * the attempts would leave the NCR offering `verify` on a report the
 * backend has already rejected.
 */
const source = readFileSync(
  new URL('./use-reinspections.ts', import.meta.url),
  'utf8'
);

describe('reinspection keys', () => {
  test('nest under their namespace roots', () => {
    expect(reinspectionKeys.byNcr('n1')).toEqual(['reinspections', 'ncr', 'n1']);
    expect(inspectionEventKeys.byNcr('n1', { page: 0 })).toEqual([
      'inspection-events',
      'ncr',
      'n1',
      { page: 0 },
    ]);
    expect(inspectionEventKeys.byInspection('i1', {})).toEqual([
      'inspection-events',
      'inspection',
      'i1',
      {},
    ]);
  });

  test('share the NCR and inspection detail shapes the console keys by', () => {
    expect(ncrKeys.detail('n1')).toEqual(['ncrs', 'detail', 'n1']);
    expect(inspectionKeys.detail('i1')).toEqual(['inspections', 'detail', 'i1']);
  });
});

describe('reinspection mutations', () => {
  test('invalidate the attempts, the timeline, the NCR and both inspections', () => {
    const start = source.indexOf('function useReinspectionInvalidation(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('export function', start));
    expect(body).toInclude('reinspectionKeys.all');
    expect(body).toInclude('inspectionEventKeys.all');
    expect(body).toInclude('ncrKeys.detail(attempt.ncrId)');
    expect(body).toInclude('inspectionKeys.detail(attempt.originalInspectionId)');
    expect(body).toInclude('inspectionKeys.detail(attempt.reinspectionInspectionId)');
  });

  test('every mutation goes through that invalidation', () => {
    for (const hook of [
      'useScheduleReinspectionForNcr',
      'useScheduleReinspectionForDefect',
      'useRecordReinspectionOutcome',
    ]) {
      const start = source.indexOf(`export function ${hook}(`);
      expect(start).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body).toInclude('useReinspectionInvalidation()');
      expect(body).toInclude('onSuccess: (attempt) => invalidate(attempt)');
    }
  });
});
