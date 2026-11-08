import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { documentIngestionKeys } from './keys';

const source = readFileSync(new URL('./use-document-ingestion-mutations.ts', import.meta.url), 'utf8');

describe('documentIngestionKeys', () => {
  test('every key shares the domain prefix', () => {
    expect(documentIngestionKeys.packages({ page: 0 })).toEqual(['document-ingestion', 'packages', { page: 0 }]);
    expect(documentIngestionKeys.boqSheets('d1')).toEqual(['document-ingestion', 'boq-sheets', 'd1']);
    expect(documentIngestionKeys.candidates('p1', { kind: 'BOQ_ITEM' })).toEqual([
      'document-ingestion',
      'candidates',
      'p1',
      { kind: 'BOQ_ITEM' },
    ]);
    expect(documentIngestionKeys.provenance('T', '1').slice(0, 1)).toEqual(['document-ingestion']);
  });
});

describe('documentIngestion mutations', () => {
  test('every mutation that writes refreshes the domain prefix', () => {
    const hooks = [...source.matchAll(/export function (use\w+)\(/g)].map((m) => m[1]);
    expect(hooks.length).toBeGreaterThan(8);
    for (const hook of hooks.filter((h) => h !== 'usePresignIngestDocument')) {
      const start = source.indexOf(`export function ${hook}(`);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body, hook).toInclude('onSuccess: invalidate');
    }
    expect(source).toInclude('queryKey: documentIngestionKeys.all');
  });
});
