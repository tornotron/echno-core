import { describe, expect, test } from 'bun:test';
import {
  INGEST_FLAG,
  INGEST_TARGET,
  changeOf,
  hasFlag,
  isProjectFieldOnProject,
  milestoneOf,
  parseCandidate,
  parseConfirmAllResult,
  parseDocumentClassification,
  parseExtractJob,
  parseIngestPage,
  parseIngestSettings,
  parseLlmCall,
  parseLlmSpend,
  parseRevisionDiff,
  parseTenderProfile,
  projectFieldOf,
} from './document-ingestion';

const job = {
  id: 'j1',
  documentId: 'd1',
  segmentId: null,
  extractorKey: 'classify',
  extractorVersion: '1',
  status: 'PARTIAL',
  attempt: 1,
  maxAttempts: 3,
  chunksTotal: 4,
  chunksDone: 3,
  chunksFailed: 1,
  message: 'Page 7 got no usable answer',
  failedPages: [{ page: 7, reason: 'NO_ANSWER', detail: 'Truncated twice' }],
  unreadPages: [{ page: 9, reason: 'NOT_ENGLISH' }],
  queuedAt: '2026-11-08T10:00:00Z',
  startedAt: null,
  finishedAt: null,
  somethingNew: 1,
};

describe('classification and extract jobs', () => {
  test('an extract job keeps its pages not read and drops a null segment', () => {
    const j = parseExtractJob(job);
    expect(j.segmentId).toBeUndefined();
    expect(j.status).toBe('PARTIAL');
    expect(j.failedPages[0]).toEqual({ page: 7, reason: 'NO_ANSWER', detail: 'Truncated twice' });
    expect(j.unreadPages[0].detail).toBeUndefined();
    expect(parseExtractJob({ id: 'j2' }).status).toBe('QUEUED');
  });

  test('a classification parses its segments and its latest job', () => {
    const c = parseDocumentClassification({
      documentId: 'd1',
      fileName: 'Tender Volume 1.pdf',
      fileType: 'PDF',
      status: 'PARSED',
      pageCount: 40,
      docClass: 'NIT',
      classMethod: 'LLM',
      classReason: 'The first page reads "Notice Inviting Tender"',
      confirmed: false,
      segments: [
        { id: 's1', docClass: 'NIT', method: 'LLM', pageFrom: 1, pageTo: 6, status: 'PROPOSED', unreadPages: [] },
        { id: 's2', docClass: 'GCC', method: 'PERSON', pageFrom: 7, pageTo: 40, status: 'CONFIRMED', unreadPages: null },
      ],
      unreadPages: [],
      classification: job,
    });
    expect(c.docClass).toBe('NIT');
    expect(c.segments.map((s) => s.pageTo)).toEqual([6, 40]);
    expect(c.segments[1].unreadPages).toEqual([]);
    expect(c.classification?.chunksDone).toBe(3);
  });

  test('a document not yet classified has no class and is not confirmed', () => {
    const c = parseDocumentClassification({ documentId: 'd2', fileName: 'BOQ.xlsx', docClass: null, classification: null });
    expect(c.docClass).toBeUndefined();
    expect(c.confirmed).toBe(false);
    expect(c.classification).toBeUndefined();
    expect(() => parseDocumentClassification({ fileName: 'no id' })).toThrow();
  });

  test('a classification page reads the backend envelope', () => {
    const page = parseIngestPage({ content: [{ documentId: 'd1' }], number: 0, totalElements: 1, totalPages: 1 }, parseDocumentClassification);
    expect(page.content[0].documentId).toBe('d1');
  });

  test('a confirm-all result fills its counts', () => {
    expect(parseConfirmAllResult({ documentsConfirmed: 3, segmentsConfirmed: 5, jobsQueued: 4 })).toEqual({
      documentsConfirmed: 3,
      segmentsConfirmed: 5,
      jobsQueued: 4,
      remaining: 0,
    });
  });
});

describe('ledger, spend and settings', () => {
  test('an AI call keeps its pages and an unknown outcome reads as a failure', () => {
    const call = parseLlmCall({
      id: 'l1',
      packageId: 'p1',
      documentId: 'd1',
      jobId: 'j1',
      chunkKey: 'pages-1-6',
      callNumber: 1,
      extractorKey: 'project-setup',
      promptVersion: 'project-2026-11-08',
      model: 'model-a',
      promptTokens: 12000,
      completionTokens: 800,
      estimatedCostUsd: 0.04,
      latencyMs: 2100,
      outcome: 'OK',
      pages: [1, 2, 3],
    });
    expect(call.pages).toEqual([1, 2, 3]);
    expect(call.estimatedCostUsd).toBe(0.04);
    expect(parseLlmCall({ id: 'l2', outcome: null }).outcome).toBe('SERVER_ERROR');
  });

  test('spend reads amounts sent as numbers or decimal strings, and exceeded only when set', () => {
    const s = parseLlmSpend({
      packageCalls: 4,
      packageTokens: 50000,
      packageCostUsd: '0.42',
      packageTokenLimit: 2000000,
      packageUsdLimit: 10,
      monthCalls: 20,
      monthTokens: 400000,
      monthCostUsd: 3.1,
      monthTokenLimit: 10000000,
      monthUsdLimit: 50,
      pricesKnown: true,
      exceeded: null,
    });
    expect(s.packageCostUsd).toBe(0.42);
    expect(s.exceeded).toBeUndefined();
    expect(parseLlmSpend({ exceeded: 'The month limit is reached' }).exceeded).toBe('The month limit is reached');
  });

  test('settings carry their recent changes, and a missing switch reads as on', () => {
    const s = parseIngestSettings({
      llmReadingEnabled: false,
      llmReadingDisclosure: 'Pages are sent to an AI service to be read.',
      monthlyBudgetUsd: null,
      monthlyBudgetTokens: 5000000,
      recentChanges: [{ setting: 'llmReading', oldValue: 'true', newValue: 'false', changedBy: 3, changedAt: '2026-11-08T09:00:00Z' }],
    });
    expect(s.llmReadingEnabled).toBe(false);
    expect(s.monthlyBudgetUsd).toBeUndefined();
    expect(s.recentChanges[0].newValue).toBe('false');
    expect(parseIngestSettings({}).llmReadingEnabled).toBe(true);
  });
});

describe('tender profile and revisions', () => {
  test('a tender profile keeps the printed text beside each typed value', () => {
    const t = parseTenderProfile({
      id: 't1',
      packageId: 'p1',
      projectId: 12,
      client: 'Riverside Water Board',
      estimatedValue: 48500000,
      estimatedValueText: 'Rs. 4.85 Crore',
      emdAmount: '970000',
      emdText: 'Rs. 9,70,000',
      bidDueAt: '2026-12-01T15:00:00Z',
      bidDueText: '01.12.2026 at 3 PM',
      bidValidityDays: 90,
      durationText: '18 months',
      tenderFeeAmount: null,
    });
    expect(t.estimatedValue).toBe(48500000);
    expect(t.emdAmount).toBe(970000);
    expect(t.emdText).toBe('Rs. 9,70,000');
    expect(t.tenderFeeAmount).toBeUndefined();
    expect(t.scope).toBeUndefined();
  });

  test('a revision comparison fills its counts', () => {
    expect(parseRevisionDiff({ itemsCompared: 120, changesProposed: 3, itemsAdded: 1 })).toEqual({
      itemsCompared: 120,
      changesProposed: 3,
      itemsAdded: 1,
      itemsRemoved: 0,
    });
  });
});

const candidate = (kind: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  parseCandidate({ id: 'c1', packageId: 'p1', kind, payload, status: 'PROPOSED', ...extra });

describe('payload readers', () => {
  test('a project field reads its value under its natural key', () => {
    const c = candidate('PROJECT_FIELD', { value: 'Lakeside Pump House' }, { naturalKey: 'project_name' });
    expect(projectFieldOf(c)).toEqual({ key: 'project_name', value: 'Lakeside Pump House' });
    expect(isProjectFieldOnProject('project_name')).toBe(true);
    expect(isProjectFieldOnProject('emd')).toBe(false);
    expect(isProjectFieldOnProject(undefined)).toBe(false);
  });

  test('a project field edited by a person reads the accepted value', () => {
    const c = candidate('PROJECT_FIELD', { value: 'Rs 4.85 Cr' }, { naturalKey: 'estimated_value', acceptedPayload: { value: 'Rs. 4.85 Crore' } });
    expect(projectFieldOf(c).value).toBe('Rs. 4.85 Crore');
  });

  test('a milestone reads its row and its order, and its flags by code', () => {
    const c = candidate(
      'MILESTONE',
      { name: 'Completion of foundations', time: 'Month 3', percent: '15%', amount: null, order: 4001 },
      { flags: [{ code: 'RELATIVE_TIME', message: '"Month 3" is counted from the start date' }] }
    );
    expect(milestoneOf(c)).toEqual({
      name: 'Completion of foundations',
      time: 'Month 3',
      percent: '15%',
      amount: undefined,
      order: 4001,
    });
    expect(hasFlag(c, INGEST_FLAG.RELATIVE_TIME)).toBe(true);
    expect(hasFlag(c, INGEST_FLAG.PERCENT_TOTAL)).toBe(false);
  });

  test('a change reads its three values and its worked-out impact as decimal strings', () => {
    const c = candidate(
      'CHANGE',
      {
        targetKind: 'BOQ_ITEM',
        target: '1.03',
        field: 'quantity',
        oldValue: '850',
        newValue: '920',
        priorValue: '850',
        quantityVariance: '70',
        moneyImpact: '686000',
        origin: 'CORRIGENDUM',
      },
      { naturalKey: 'BOQ_ITEM:1.03:quantity', flags: [{ code: 'TENDER_IMPACT', message: 'Before award' }] }
    );
    const change = changeOf(c);
    expect(change.quantityVariance).toBe('70');
    expect(change.moneyImpact).toBe('686000');
    expect(change.origin).toBe('CORRIGENDUM');
    expect(change.overrideRecord).toBe(false);
    expect(hasFlag(c, INGEST_FLAG.TENDER_IMPACT)).toBe(true);
  });

  test('a change chosen over a hand edit reads its override, and a number reads as text', () => {
    const c = candidate('CHANGE', { target: '2.01', field: 'rate', newValue: 410 }, {
      status: 'ACCEPTED',
      acceptedPayload: { target: '2.01', field: 'rate', newValue: 410, overrideRecord: true },
    });
    expect(changeOf(c).newValue).toBe('410');
    expect(changeOf(c).overrideRecord).toBe(true);
  });

  test('a payload field of an unexpected type reads as absent, never as a throw', () => {
    const c = candidate('CHANGE', { target: { nested: true }, field: ['x'], oldValue: '' });
    const change = changeOf(c);
    expect(change.target).toBeUndefined();
    expect(change.field).toBeUndefined();
    expect(change.oldValue).toBeUndefined();
    expect(milestoneOf(candidate('MILESTONE', { order: '3' })).order).toBeUndefined();
  });

  test('every target type is named once', () => {
    expect((Object.values(INGEST_TARGET) as string[]).sort()).toEqual(
      [
        'CANDIDATE',
        'CONTRACT_BOQ_ITEM',
        'CONTRACT_MILESTONE',
        'PROJECT',
        'TENDER_PROFILE',
        'WBS_ELEMENT',
        'CONTRACT_TERM',
        'OBLIGATION',
        'DRAWING',
        'QUALITY_REQUIREMENT',
        'QUALIFICATION_REQUIREMENT',
        'PROJECT_RISK',
      ].sort()
    );
  });
});
