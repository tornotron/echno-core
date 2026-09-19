import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { toolboxTalksKeys } from './keys';

const source = readFileSync(
  new URL('./use-toolbox-talks-mutations.ts', import.meta.url),
  'utf8'
);

describe('toolboxTalksKeys', () => {
  test('list and detail keys share the domain prefix', () => {
    expect(toolboxTalksKeys.list({ page: 0 })).toEqual(['toolbox-talks', 'list', { page: 0 }]);
    expect(toolboxTalksKeys.detail('11')).toEqual(['toolbox-talks', 'detail', '11']);
  });
});

describe('toolboxTalks mutations', () => {
  test('every mutation invalidates the domain prefix', () => {
    for (const hook of ['useCreateToolboxTalks', 'useUpdateToolboxTalks']) {
      const start = source.indexOf(`export function ${hook}(`);
      expect(start, hook).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body, hook).toInclude('onSuccess: invalidate');
    }
    expect(source).toInclude('queryKey: toolboxTalksKeys.all');
  });
});
