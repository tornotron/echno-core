import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { wbsKeys } from '../wbs/keys';
import { workProgressKeys } from './keys';

const source = readFileSync(new URL('./use-work-progress-mutations.ts', import.meta.url), 'utf8');
const wbsSource = readFileSync(new URL('../wbs/use-wbs-mutations.ts', import.meta.url), 'utf8');

describe('schedule and work-progress keys', () => {
  test('keys share their domain prefix', () => {
    expect(wbsKeys.schedule(7)).toEqual(['wbs', 'schedule', 7]);
    expect(workProgressKeys.list({ projectId: 7 })).toEqual(['work-progress', 'list', { projectId: 7 }]);
    expect(workProgressKeys.evidence('r1')).toEqual(['work-progress', 'detail', 'r1', 'evidence']);
  });

  test('recording progress refreshes the schedule as well', () => {
    expect(source).toInclude('queryKey: workProgressKeys.all');
    expect(source).toInclude('queryKey: wbsKeys.all');
    for (const hook of ['useRecordProgressInspection', 'useRegisterProgressInspectionEvidence']) {
      const start = source.indexOf(`export function ${hook}(`);
      expect(start, hook).toBeGreaterThan(-1);
      expect(source.slice(start, source.indexOf('\n}\n', start)), hook).toInclude('onSuccess: invalidate');
    }
  });

  test('every schedule mutation invalidates the schedule prefix', () => {
    for (const hook of ['useCreateWbsActivity', 'useUpdateWbsActivity', 'useDeleteWbsActivity', 'useAddWbsDependency', 'useRemoveWbsDependency']) {
      const start = wbsSource.indexOf(`export function ${hook}(`);
      expect(start, hook).toBeGreaterThan(-1);
      expect(wbsSource.slice(start, wbsSource.indexOf('\n}\n', start)), hook).toInclude('onSuccess: invalidate');
    }
  });
});
