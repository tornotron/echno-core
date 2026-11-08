import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { visionKeys } from './keys';

const queries = readFileSync(new URL('./use-vision.ts', import.meta.url), 'utf8');
const mutations = readFileSync(new URL('./use-vision-mutations.ts', import.meta.url), 'utf8');

describe('visionKeys', () => {
  test('every key shares the domain prefix', () => {
    expect(visionKeys.models()).toEqual(['vision', 'models']);
    expect(visionKeys.modelVersion('ppe', '0.1.0')).toEqual([
      'vision',
      'models',
      'ppe',
      'versions',
      '0.1.0',
    ]);
    expect(visionKeys.settings()).toEqual(['vision', 'settings']);
  });
});

describe('vision hooks', () => {
  test('every query can be held back until the module is known to be on', () => {
    for (const hook of ['useVisionModels', 'useVisionModelVersion', 'useVisionSettings']) {
      const start = queries.indexOf(`export function ${hook}(`);
      expect(start, hook).toBeGreaterThan(-1);
      const body = queries.slice(start, queries.indexOf('\n}\n', start));
      expect(body, hook).toInclude('options: { enabled?: boolean } = {}');
      expect(body, hook).toInclude('options.enabled ?? true');
    }
  });

  test('saving settings writes the cache and refreshes the domain', () => {
    const start = mutations.indexOf('export function useUpdateVisionSettings(');
    const body = mutations.slice(start, mutations.indexOf('\n}\n', start));
    expect(body).toInclude('setQueryData(visionKeys.settings(), settings)');
    expect(body).toInclude('queryKey: visionKeys.all');
  });
});
