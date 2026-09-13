import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { bimKeys } from './keys';

/**
 * `bimKeys.model(id)` does not nest under `bimKeys.projectModels(pid)`, and
 * the project list is what the web renders (it carries the nested versions
 * and status). Pinned by reading the source, the way the inspection hook
 * tests do: every model-level mutation must refresh the project list too.
 */
const source = readFileSync(new URL('./use-bim-mutations.ts', import.meta.url), 'utf8');

describe('bim keys', () => {
  test('the project list sits under a prefix the model key does not share', () => {
    expect(bimKeys.projectModels(7)).toEqual(['bim', 'project', 7, 'models']);
    expect(bimKeys.projects()).toEqual(['bim', 'project']);
    expect(bimKeys.model('m1')).toEqual(['bim', 'model', 'm1']);
  });
});

describe('bim model mutations', () => {
  const hooks = [
    'usePresignBimSource',
    'useRegisterBimSource',
    'useEnqueueBimImport',
    'useRegenerateBimHierarchyProposal',
    'useConfirmBimHierarchy',
    'useMergeBimElement',
  ];

  test('invalidateModel refreshes the model and the project list', () => {
    const start = source.indexOf('function invalidateModel(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n}\n', start));
    expect(body).toInclude('bimKeys.model(modelId)');
    expect(body).toInclude('bimKeys.projectModels(projectId)');
    expect(body).toInclude('bimKeys.projects()');
  });

  test('every model-level mutation goes through invalidateModel', () => {
    for (const hook of hooks) {
      const start = source.indexOf(`export function ${hook}(`);
      expect(start, hook).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body, hook).toInclude('invalidateModel(queryClient, modelId, projectId)');
      expect(body, hook).not.toInclude('queryKey: bimKeys.model(modelId)');
    }
  });
});
