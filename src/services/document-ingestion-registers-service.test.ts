import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { documentIngestionService } from './document-ingestion-service';

const emptyPage = { content: [], number: 0, totalElements: 0, totalPages: 0 };
const risk = { riskId: 'r1', riskNumber: 'R-007', projectId: 7, created: true };

afterEach(() => {
  for (const method of ['get', 'post', 'put', 'delete'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('contract terms and obligations', () => {
  test('the registers and the coverage read sit under the package', async () => {
    spyOn(api, 'get').mockResolvedValueOnce([{ id: 't1', term: 'ld_rate', value: '1%' }]);
    const terms = await documentIngestionService.listContractTerms('p1');
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/contract-terms');
    expect(terms[0].term).toBe('ld_rate');

    (api.get as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({ read: [], terms: [] });
    await documentIngestionService.getContractTermCoverage('p1');
    expect(api.get).toHaveBeenLastCalledWith('/document-ingestion/packages/p1/contract-terms/coverage');
  });

  test('obligations are listed by page', async () => {
    spyOn(api, 'get').mockResolvedValue(emptyPage);
    await documentIngestionService.listObligations('p1', { page: 1, size: 20 });
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/obligations', { page: 1, size: 20 });
  });

  test('a risk is raised with only the choices given', async () => {
    spyOn(api, 'post').mockResolvedValue(risk);
    const raised = await documentIngestionService.raiseContractTermRisk('t1');
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/contract-terms/t1/risk', {});
    expect(raised).toEqual(risk);
    await documentIngestionService.raiseObligationRisk('o1', { impact: 'major', owner: 'Site manager' });
    expect(api.post).toHaveBeenLastCalledWith('/document-ingestion/obligations/o1/risk', {
      impact: 'major',
      owner: 'Site manager',
    });
  });
});

describe('drawings', () => {
  test('the register passes currentOnly only when it is set', async () => {
    spyOn(api, 'get').mockResolvedValue(emptyPage);
    await documentIngestionService.listDrawings('p1');
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/drawings', {});
    await documentIngestionService.listDrawings('p1', { currentOnly: true, page: 0 });
    expect(api.get).toHaveBeenLastCalledWith('/document-ingestion/packages/p1/drawings', { page: 0, currentOnly: true });
  });

  test("a number's revision chain is a list", async () => {
    spyOn(api, 'get').mockResolvedValue([{ id: 'w0', revision: 'B' }, { id: 'w1', revision: 'C', current: true }]);
    const chain = await documentIngestionService.listDrawingRevisions('w1');
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/drawings/w1/revisions');
    expect(chain.map((d) => d.revision)).toEqual(['B', 'C']);
  });

  test('a title-block image is null on 404 and still throws when the module is off', async () => {
    const get = spyOn(api, 'get');
    get.mockResolvedValueOnce({ url: 'https://store.example/crop.png', expiresInSeconds: 300 });
    expect(await documentIngestionService.getTitleBlockImage('d1', 4)).toEqual({
      url: 'https://store.example/crop.png',
      expiresInSeconds: 300,
    });
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/documents/d1/title-blocks/4/image');

    get.mockRejectedValueOnce(new ApiError('Not found', 404));
    expect(await documentIngestionService.getTitleBlockImage('d1', 5)).toBeNull();

    get.mockRejectedValueOnce(new ApiError('Module disabled', 403, undefined, undefined, undefined, { code: 'MODULE_DISABLED' }));
    await expect(documentIngestionService.getTitleBlockImage('d1', 4)).rejects.toThrow();
  });
});

describe('quality requirements', () => {
  test('the ITP is read per package and per project', async () => {
    spyOn(api, 'get').mockResolvedValue(emptyPage);
    await documentIngestionService.listQualityRequirements('p1', { size: 100 });
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/quality-requirements', { size: 100 });
    await documentIngestionService.listProjectQualityRequirements(7);
    expect(api.get).toHaveBeenLastCalledWith('/document-ingestion/projects/7/quality-requirements', {});
  });

  test('copy-to-template sends a trade only when one is chosen', async () => {
    spyOn(api, 'post').mockResolvedValue({ rows: [], templates: [] });
    await documentIngestionService.copyQualityRequirementsToTemplate({ requirementIds: ['q1', 'q2'] });
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/quality-requirements/copy-to-template', {
      requirementIds: ['q1', 'q2'],
    });
    await documentIngestionService.copyQualityRequirementsToTemplate({ requirementIds: ['q1'], tradeId: 'tr1' });
    expect(api.post).toHaveBeenLastCalledWith('/document-ingestion/quality-requirements/copy-to-template', {
      requirementIds: ['q1'],
      tradeId: 'tr1',
    });
  });
});

describe('qualification, the matrix and the company profile', () => {
  test('a status is put with a null to clear it', async () => {
    spyOn(api, 'put').mockResolvedValue({ id: 'r1', requirement: 'equipment', personStatus: null });
    await documentIngestionService.setQualificationStatus('r1', { status: null });
    expect(api.put).toHaveBeenCalledWith('/document-ingestion/qualification-requirements/r1/status', { status: null });
    await documentIngestionService.setQualificationStatus('r1', { status: 'GAP', note: 'One crane short.' });
    expect(api.put).toHaveBeenLastCalledWith('/document-ingestion/qualification-requirements/r1/status', {
      status: 'GAP',
      note: 'One crane short.',
    });
  });

  test('the requirements and the matrix sit under the package', async () => {
    const get = spyOn(api, 'get');
    get.mockResolvedValueOnce([{ id: 'r1', requirement: 'turnover' }]);
    expect((await documentIngestionService.listQualificationRequirements('p1'))[0].requirement).toBe('turnover');
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/packages/p1/qualification-requirements');
    get.mockResolvedValueOnce({ packageId: 'p1', shown: true, rows: [] });
    await documentIngestionService.getComplianceMatrix('p1');
    expect(api.get).toHaveBeenLastCalledWith('/document-ingestion/packages/p1/compliance-matrix');
  });

  test('saving the profile sends the whole profile, empty where nothing was given', async () => {
    spyOn(api, 'put').mockResolvedValue({ id: 'cp1' });
    await documentIngestionService.saveCompanyProfile({ yearsInBusiness: 11, turnover: [{ financialYear: '2025-26', amount: 1 }] });
    expect(api.put).toHaveBeenCalledWith('/document-ingestion/company-profile', {
      yearsInBusiness: 11,
      turnover: [{ financialYear: '2025-26', amount: 1 }],
      similarProjects: [],
      equipment: [],
      personnel: [],
    });
  });

  test('evidence uploads in three steps and can be downloaded and removed', async () => {
    spyOn(api, 'post')
      .mockResolvedValueOnce({
        evidenceId: 'e1',
        upload: { key: 'k1', url: 'https://store.example/put', contentType: 'application/pdf', expiresInSeconds: 600 },
      })
      .mockResolvedValueOnce({ id: 'e1', section: 'TURNOVER', fileName: 'Accounts.pdf', uploaded: true });
    const upload = await documentIngestionService.presignCompanyEvidence({
      section: 'TURNOVER',
      fileName: 'Accounts.pdf',
      fileSize: 2048,
    });
    expect(api.post).toHaveBeenCalledWith('/document-ingestion/company-profile/evidence/presign', {
      section: 'TURNOVER',
      fileName: 'Accounts.pdf',
      fileSize: 2048,
    });
    const evidence = await documentIngestionService.registerCompanyEvidence(upload.evidenceId, upload.upload.key);
    expect(api.post).toHaveBeenLastCalledWith('/document-ingestion/company-profile/evidence/e1/register', { key: 'k1' });
    expect(evidence.uploaded).toBe(true);

    spyOn(api, 'get').mockResolvedValue({ url: 'https://store.example/get', expiresInSeconds: 300 });
    await documentIngestionService.getCompanyEvidenceDownloadUrl('e1');
    expect(api.get).toHaveBeenCalledWith('/document-ingestion/company-profile/evidence/e1/download');

    spyOn(api, 'delete').mockResolvedValue(undefined);
    await documentIngestionService.deleteCompanyEvidence('e1');
    expect(api.delete).toHaveBeenCalledWith('/document-ingestion/company-profile/evidence/e1');
  });
});
