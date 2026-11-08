import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { documentIngestionService } from './document-ingestion-service';

const spend = { packageCalls: 1, packageTokens: 10, packageCostUsd: 0.01, pricesKnown: true, exceeded: null };
const settings = { llmReadingEnabled: true, llmReadingDisclosure: 'Pages are sent to an AI service.', recentChanges: [] };
const emptyPage = { content: [], number: 0, totalElements: 0, totalPages: 0 };

afterEach(() => {
  for (const method of ['get', 'post', 'put'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('classification', () => {
  test('a class is put with its page ranges only when given', async () => {
    spyOn(api, 'put').mockResolvedValue({ documentId: 'd1', fileName: 'Tender.pdf', docClass: 'NIT', confirmed: true });
    const c = await documentIngestionService.classifyDocument('d1', { docClass: 'NIT' });
    expect(api.put).toHaveBeenCalledWith('/document-ingestion/documents/d1/classification', { docClass: 'NIT' });
    expect(c.confirmed).toBe(true);
    await documentIngestionService.classifyDocument('d1', {
      docClass: 'NIT',
      segments: [
        { docClass: 'NIT', pageFrom: 1, pageTo: 6 },
        { docClass: 'GCC', pageFrom: 7, pageTo: 40 },
      ],
    });
    expect(api.put).toHaveBeenLastCalledWith('/document-ingestion/documents/d1/classification', {
      docClass: 'NIT',
      segments: [
        { docClass: 'NIT', pageFrom: 1, pageTo: 6 },
        { docClass: 'GCC', pageFrom: 7, pageTo: 40 },
      ],
    });
  });

  test('classifications are listed by page', async () => {
    spyOn(api, 'get').mockResolvedValue(emptyPage);
    await documentIngestionService.listClassifications('p1', { page: 1, size: 100 });
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/classification', { page: 1, size: 100 });
  });

  test('confirm-all calls again while documents remain and adds the counts up', async () => {
    const post = spyOn(api, 'post');
    post.mockResolvedValueOnce({ documentsConfirmed: 200, segmentsConfirmed: 260, jobsQueued: 240, remaining: 12 });
    post.mockResolvedValueOnce({ documentsConfirmed: 12, segmentsConfirmed: 14, jobsQueued: 13, remaining: 0 });
    const total = await documentIngestionService.confirmAllClassificationsFully('p1');
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/packages/p1/classification/confirm-all');
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(total).toEqual({ documentsConfirmed: 212, segmentsConfirmed: 274, jobsQueued: 253, remaining: 0 });
  });

  test('confirm-all stops when a call confirms nothing', async () => {
    spyOn(api, 'post').mockResolvedValue({ documentsConfirmed: 0, segmentsConfirmed: 0, jobsQueued: 0, remaining: 3 });
    const total = await documentIngestionService.confirmAllClassificationsFully('p1');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(total.remaining).toBe(3);
  });
});

describe('extract jobs and the ledger', () => {
  test('jobs are listed per package and a job retries only its failed chunks', async () => {
    spyOn(api, 'get').mockResolvedValue(emptyPage);
    await documentIngestionService.listExtractJobs('p1');
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/extract-jobs', {});
    spyOn(api, 'post').mockResolvedValue({ id: 'j1', status: 'QUEUED' });
    const job = await documentIngestionService.retryFailedChunks('j1');
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/extract-jobs/j1/retry-failed');
    expect(job.status).toBe('QUEUED');
  });

  test('the organization ledger takes package and file filters', async () => {
    spyOn(api, 'get').mockResolvedValue(emptyPage);
    await documentIngestionService.listLlmCalls({ packageId: 'p1', documentId: 'd1', page: 0 });
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/llm-calls', { page: 0, packageId: 'p1', documentId: 'd1' });
  });

  test("a package's ledger sits under the package and ignores a package filter", async () => {
    spyOn(api, 'get').mockResolvedValue(emptyPage);
    await documentIngestionService.listPackageLlmCalls('p1', { packageId: 'p9', documentId: 'd1' });
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/llm-calls', { documentId: 'd1' });
  });

  test('a package budget sends both limits, null meaning the default', async () => {
    spyOn(api, 'get').mockResolvedValue(spend);
    expect((await documentIngestionService.getLlmSpend('p1')).pricesKnown).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/llm-spend');
    spyOn(api, 'put').mockResolvedValue(spend);
    await documentIngestionService.setPackageLlmBudget('p1', { budgetUsd: 12.5, budgetTokens: null });
    expect(api.put).toHaveBeenCalledWith('/document-ingestion/packages/p1/llm-budget', { budgetUsd: 12.5, budgetTokens: null });
  });
});

describe('settings', () => {
  test('settings are read, the monthly limit set and AI reading switched', async () => {
    spyOn(api, 'get').mockResolvedValue(settings);
    expect((await documentIngestionService.getSettings()).llmReadingEnabled).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/settings');
    spyOn(api, 'put').mockResolvedValue({ ...settings, llmReadingEnabled: false });
    await documentIngestionService.setMonthlyLlmBudget({ budgetUsd: null, budgetTokens: 5000000 });
    expect(api.put).toHaveBeenCalledWith('/document-ingestion/settings/llm-budget', { budgetUsd: null, budgetTokens: 5000000 });
    const after = await documentIngestionService.setLlmReading(false);
    expect(api.put).toHaveBeenLastCalledWith('/document-ingestion/settings/llm-reading', { enabled: false });
    expect(after.llmReadingEnabled).toBe(false);
  });
});

describe('tender profile', () => {
  test('a profile is read under its package', async () => {
    spyOn(api, 'get').mockResolvedValue({ id: 't1', packageId: 'p1', client: 'Riverside Water Board' });
    const t = await documentIngestionService.getTenderProfile('p1');
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/tender-profile');
    expect(t?.client).toBe('Riverside Water Board');
  });

  test('no profile yet is null, but the module being off still throws', async () => {
    const get = spyOn(api, 'get');
    get.mockRejectedValueOnce(new ApiError('Not found', 404));
    expect(await documentIngestionService.getTenderProfile('p1')).toBeNull();
    get.mockRejectedValueOnce(new ApiError('Module disabled', 403, undefined, undefined, undefined, { code: 'MODULE_DISABLED' }));
    await expect(documentIngestionService.getTenderProfile('p1')).rejects.toThrow(ApiError);
  });
});

describe('revisions and changes', () => {
  test('a revision is put with its label only when given', async () => {
    spyOn(api, 'put').mockResolvedValue({ id: 'd2', packageId: 'p1', fileName: 'BOQ rev 1.xlsx', supersedesDocumentId: 'd1' });
    const doc = await documentIngestionService.setRevision('d2', { supersedesDocumentId: 'd1' });
    expect(api.put).toHaveBeenCalledWith('/document-ingestion/documents/d2/revision', { supersedesDocumentId: 'd1' });
    expect(doc.supersedesDocumentId).toBe('d1');
    await documentIngestionService.setRevision('d2', { supersedesDocumentId: 'd1', revisionLabel: 'Corrigendum 1' });
    expect(api.put).toHaveBeenLastCalledWith('/document-ingestion/documents/d2/revision', {
      supersedesDocumentId: 'd1',
      revisionLabel: 'Corrigendum 1',
    });
  });

  test('a revised file is compared with no body', async () => {
    spyOn(api, 'post').mockResolvedValue({ itemsCompared: 120, changesProposed: 3, itemsAdded: 1, itemsRemoved: 0 });
    const diff = await documentIngestionService.diffRevision('d2');
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/documents/d2/revision-diff');
    expect(diff.changesProposed).toBe(3);
  });

  test('a conflict choice is posted on the change', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: 'c1', kind: 'CHANGE', status: 'ACCEPTED', payload: {}, acceptedPayload: { overrideRecord: true } });
    const c = await documentIngestionService.resolveConflict('c1', 'APPLY_CHANGE');
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/candidates/c1/conflict', { choice: 'APPLY_CHANGE' });
    expect(c.status).toBe('ACCEPTED');
  });
});
