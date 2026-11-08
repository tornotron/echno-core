import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { documentIngestionService, isModuleDisabled } from './document-ingestion-service';

const pkg = { id: 'p1', name: 'Tender', projectId: 7, subContractId: null, stage: 'TENDER', status: 'OPEN', documentCount: 1 };
const sheet = {
  id: 's1',
  documentId: 'd1',
  segmentId: null,
  sheetName: 'BOQ',
  sheetIndex: 0,
  hidden: false,
  status: 'DETECTED',
  headerRow: 1,
  columns: { itemCode: 1, description: 2, unit: 3, quantity: 4, rate: 5, amount: 6 },
  preview: [],
  rowCount: 5,
};

afterEach(() => {
  for (const method of ['get', 'post', 'put'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('documentIngestionService paths', () => {
  test('packages are created with only the fields given', async () => {
    spyOn(api, 'post').mockResolvedValue(pkg);
    await documentIngestionService.createPackage({ name: 'Tender', projectId: 7 });
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/packages', { name: 'Tender', projectId: 7 });
  });

  test('the BOQ target is put on the package, and null clears it', async () => {
    spyOn(api, 'put').mockResolvedValue({ ...pkg, subContractId: 42 });
    const updated = await documentIngestionService.setBoqTarget('p1', { subContractId: 42 });
    expect(api.put).toHaveBeenCalledWith('/document-ingestion/packages/p1/boq-target', { subContractId: 42 });
    expect(updated.subContractId).toBe(42);
    await documentIngestionService.setBoqTarget('p1', { subContractId: null });
    expect(api.put).toHaveBeenLastCalledWith('/document-ingestion/packages/p1/boq-target', { subContractId: null });
  });

  test('upload is presign then register with the returned key', async () => {
    const post = spyOn(api, 'post');
    post.mockResolvedValueOnce({
      documentId: 'd1',
      upload: { key: 'doc-ingest/1/p1/d1/source', url: 'https://store.example/put', contentType: 'application/x', expiresInSeconds: 600 },
    });
    const up = await documentIngestionService.presignDocument('p1', { fileName: 'BOQ.xlsx', fileSize: 1024 });
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/packages/p1/documents/presign', {
      fileName: 'BOQ.xlsx',
      fileSize: 1024,
    });
    expect(up.upload.key).toBe('doc-ingest/1/p1/d1/source');
    post.mockResolvedValueOnce({ id: 'd1', packageId: 'p1', fileName: 'BOQ.xlsx', status: 'QUEUED', sizeBytes: 1024 });
    const doc = await documentIngestionService.registerDocument('p1', 'd1', up.upload.key);
    expect(api.post).toHaveBeenLastCalledWith('/document-ingestion/packages/p1/documents/d1/register', {
      key: 'doc-ingest/1/p1/d1/source',
    });
    expect(doc.status).toBe('QUEUED');
  });

  test('BOQ sheets are detected, listed and read under a mapping', async () => {
    spyOn(api, 'post').mockResolvedValue([sheet]);
    const found = await documentIngestionService.detectBoqSheets('d1');
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/documents/d1/boq/sheets/detect');
    expect(found[0].columns.quantity).toBe(4);

    (api.post as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ ...sheet, status: 'EXTRACTED' });
    const read = await documentIngestionService.extractBoqSheet('d1', 's1', {
      headerRow: 1,
      columns: { description: 2, quantity: 4 },
      codePrefix: 'E-',
    });
    expect(api.post).toHaveBeenLastCalledWith('/document-ingestion/documents/d1/boq/sheets/s1/extract', {
      headerRow: 1,
      columns: { description: 2, quantity: 4 },
      codePrefix: 'E-',
    });
    expect(read.status).toBe('EXTRACTED');
  });

  test('candidates are filtered by kind, status and segment', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [], totalElements: 0, number: 0 });
    await documentIngestionService.listCandidates('p1', { kind: 'BOQ_ITEM', segmentId: 'seg', page: 2, size: 200 });
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/candidates', {
      page: 2,
      size: 200,
      kind: 'BOQ_ITEM',
      segmentId: 'seg',
    });
  });

  test('decisions carry edits and acknowledged flags only when given', async () => {
    spyOn(api, 'post').mockResolvedValue([{ candidateId: 'c1', outcome: 'ACCEPTED', message: null }]);
    const outcomes = await documentIngestionService.decide('p1', [
      { candidateId: 'c1', action: 'EDIT', edits: { quantity: '5' }, acknowledgedFlags: ['UNPRICED'] },
      { candidateId: 'c2', action: 'REJECT' },
    ]);
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/packages/p1/candidates/decisions', {
      decisions: [
        { candidateId: 'c1', action: 'EDIT', edits: { quantity: '5' }, acknowledgedFlags: ['UNPRICED'] },
        { candidateId: 'c2', action: 'REJECT' },
      ],
    });
    expect(outcomes[0].outcome).toBe('ACCEPTED');
  });

  test('applyAll calls again while rows remain and adds the results up', async () => {
    const post = spyOn(api, 'post');
    post.mockResolvedValueOnce({ applied: 5000, failed: 1, remaining: 300 });
    post.mockResolvedValueOnce({ applied: 300, failed: 0, remaining: 0 });
    const total = await documentIngestionService.applyAll('p1', 'BOQ_ITEM');
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/packages/p1/apply', undefined, { kind: 'BOQ_ITEM' });
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(total).toEqual({ applied: 5300, failed: 1, remaining: 0 });
  });

  test('provenance is read by target', async () => {
    spyOn(api, 'get').mockResolvedValue([
      {
        id: 'v1',
        targetType: 'CONTRACT_BOQ_ITEM',
        targetId: 'b1',
        targetField: 'contractQuantity',
        valueAccepted: '850',
        enteredByHand: false,
        source: { id: 'r1', field: 'quantity', sheet: 'BOQ', rowNumber: 4, cell: 'D4', quoteVerified: true },
      },
    ]);
    const trail = await documentIngestionService.provenance('CONTRACT_BOQ_ITEM', 'b1');
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/provenance', {
      targetType: 'CONTRACT_BOQ_ITEM',
      targetId: 'b1',
    });
    expect(trail[0].source?.cell).toBe('D4');
  });

  test('a malformed package is an ApiError, never a half-parsed object', async () => {
    spyOn(api, 'get').mockResolvedValue({ name: 'no id' });
    await expect(documentIngestionService.getPackage('p1')).rejects.toThrow(ApiError);
  });

  test('MODULE_DISABLED is recognised by its code, and nothing else is', () => {
    const off = new ApiError('Module disabled', 403, undefined, undefined, 'Module disabled', { code: 'MODULE_DISABLED' });
    expect(isModuleDisabled(off)).toBe(true);
    expect(isModuleDisabled(new ApiError('Forbidden', 403))).toBe(false);
    expect(isModuleDisabled(new ApiError('Missing', 404, undefined, undefined, undefined, { code: 'MODULE_DISABLED' }))).toBe(false);
    expect(isModuleDisabled(new Error('x'))).toBe(false);
  });
});
