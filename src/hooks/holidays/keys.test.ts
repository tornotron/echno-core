import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { holidaysKeys } from './keys';

const source = readFileSync(
  new URL('./use-holidays-mutations.ts', import.meta.url),
  'utf8'
);

describe('holidaysKeys', () => {
  test('year, detail and working-week keys share the domain prefix', () => {
    expect(holidaysKeys.year(2026)).toEqual(['holidays', 'year', 2026]);
    expect(holidaysKeys.detail(11)).toEqual(['holidays', 'detail', 11]);
    expect(holidaysKeys.workingWeek()).toEqual(['holidays', 'working-week']);
  });
});

describe('holidays mutations', () => {
  test('every mutation invalidates the domain prefix', () => {
    for (const hook of [
      'useCreateHoliday',
      'useUpdateHoliday',
      'useDeleteHoliday',
      'useUpdateWorkingWeek',
    ]) {
      const start = source.indexOf(`export function ${hook}(`);
      expect(start, hook).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body, hook).toInclude('onSuccess: invalidate');
    }
    expect(source).toInclude('queryKey: holidaysKeys.all');
  });
});
