import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { toolboxTalksKeys } from './keys';

const source = readFileSync(
  new URL('./use-toolbox-talks-mutations.ts', import.meta.url),
  'utf8'
);

describe('toolboxTalksKeys', () => {
  test('list, detail and photos keys share the domain prefix', () => {
    expect(toolboxTalksKeys.list({ projectId: 7, pageNo: 0 })).toEqual([
      'toolbox-talks',
      'list',
      { projectId: 7, pageNo: 0 },
    ]);
    expect(toolboxTalksKeys.detail('t1')).toEqual(['toolbox-talks', 'detail', 't1']);
    expect(toolboxTalksKeys.photos('t1')).toEqual(['toolbox-talks', 'detail', 't1', 'photos']);
  });
});

describe('toolboxTalks mutations', () => {
  test('every mutation invalidates the domain prefix', () => {
    for (const hook of [
      'useCreateToolboxTalk',
      'useUpdateToolboxTalk',
      'useAddToolboxTalkAttendees',
      'useRemoveToolboxTalkAttendee',
      'useRecordToolboxTalk',
      'useRegisterToolboxTalkPhotos',
    ]) {
      const start = source.indexOf(`export function ${hook}(`);
      expect(start, hook).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body, hook).toInclude('onSuccess: invalidate');
    }
    expect(source).toInclude('queryKey: toolboxTalksKeys.all');
  });
});
