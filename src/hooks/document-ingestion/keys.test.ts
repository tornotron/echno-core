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
    expect(documentIngestionKeys.classification('p1')).toEqual(['document-ingestion', 'classification', 'p1', {}]);
    expect(documentIngestionKeys.extractJobs('p1', { page: 1 })).toEqual(['document-ingestion', 'extract-jobs', 'p1', { page: 1 }]);
    expect(documentIngestionKeys.llmCalls({ packageId: 'p1' })).toEqual(['document-ingestion', 'llm-calls', { packageId: 'p1' }]);
    expect(documentIngestionKeys.drawings('p1', { currentOnly: true })).toEqual([
      'document-ingestion',
      'drawings',
      'p1',
      { currentOnly: true },
    ]);
    expect(documentIngestionKeys.obligations('p1')).toEqual(['document-ingestion', 'obligations', 'p1', {}]);
    expect(documentIngestionKeys.projectQualityRequirements(42, { page: 2 })).toEqual([
      'document-ingestion',
      'project-quality-requirements',
      42,
      { page: 2 },
    ]);
    for (const key of [
      documentIngestionKeys.packageLlmCalls('p1'),
      documentIngestionKeys.llmSpend('p1'),
      documentIngestionKeys.settings(),
      documentIngestionKeys.tenderProfile('p1'),
      documentIngestionKeys.contractTerms('p1'),
      documentIngestionKeys.contractTermCoverage('p1'),
      documentIngestionKeys.drawingRevisions('w1'),
      documentIngestionKeys.titleBlockImage('d1', 3),
      documentIngestionKeys.qualificationRequirements('p1'),
      documentIngestionKeys.complianceMatrix('p1'),
      documentIngestionKeys.companyProfile(),
    ]) {
      expect(key[0]).toBe('document-ingestion');
    }
  });
});

describe('documentIngestion mutations', () => {
  test('every mutation that writes refreshes the domain prefix', () => {
    const hooks = [...source.matchAll(/export function (use\w+)\(/g)].map((m) => m[1]);
    expect(hooks.length).toBeGreaterThan(8);
    // A presign writes nothing a screen shows until its file is registered.
    for (const hook of hooks.filter((h) => !h.startsWith('usePresign'))) {
      const start = source.indexOf(`export function ${hook}(`);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body, hook).toInclude('onSuccess: invalidate');
    }
    expect(source).toInclude('queryKey: documentIngestionKeys.all');
  });

  test('a write that reaches another domain refreshes that domain as well', () => {
    for (const [hook, key] of [
      ['useRaiseContractTermRisk', 'riskKeys.all'],
      ['useRaiseObligationRisk', 'riskKeys.all'],
      ['useCopyQualityRequirementsToTemplate', 'checklistTemplateKeys.all'],
    ]) {
      const start = source.indexOf(`export function ${hook}(`);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body, hook).toInclude(`useInvalidateDocumentIngestion([${key}])`);
    }
  });
});

describe('isExtractJobActive', () => {
  test('a job waiting on the AI service or the budget still counts as moving', async () => {
    const { isExtractJobActive } = await import('./use-document-ingestion');
    const { parseExtractJob } = await import('../../types/document-ingestion/document-ingestion');
    const active = ['QUEUED', 'RUNNING', 'WAITING_LLM', 'PAUSED_BUDGET'];
    for (const status of ['QUEUED', 'RUNNING', 'WAITING_LLM', 'PAUSED_BUDGET', 'PARTIAL', 'DONE', 'FAILED']) {
      expect(isExtractJobActive(parseExtractJob({ id: 'j', status })), status).toBe(active.includes(status));
    }
  });
});
