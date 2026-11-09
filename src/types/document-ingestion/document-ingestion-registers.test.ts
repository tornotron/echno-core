import { describe, expect, test } from 'bun:test';
import { INGEST_FLAG, hasFlag, parseCandidate } from './document-ingestion';
import {
  CONTRACT_TERM_KEYS,
  contractTermOf,
  drawingOf,
  isQualificationSetByPerson,
  obligationOf,
  parseCompanyProfile,
  parseComplianceMatrix,
  parseContractTermCoverage,
  parseContractTermEntry,
  parseCopyToTemplateResult,
  parseDrawingEntry,
  parseEvidenceUpload,
  parseObligationEntry,
  parseQualificationRequirementEntry,
  parseQualityRequirementEntry,
  parseRaisedRisk,
  qualificationRequirementKeyOf,
  qualificationRequirementOf,
  qualityRequirementOf,
} from './document-ingestion-registers';

const candidate = (kind: string, naturalKey: string, payload: unknown, extra: Record<string, unknown> = {}) =>
  parseCandidate({ id: 'c1', packageId: 'p1', kind, naturalKey, payload, status: 'PROPOSED', ...extra });

describe('contract terms and obligations', () => {
  test('there are 19 contract terms', () => {
    expect(CONTRACT_TERM_KEYS).toHaveLength(19);
    expect(new Set(CONTRACT_TERM_KEYS).size).toBe(19);
  });

  test('a term entry parses, and a missing label falls back to the term', () => {
    const t = parseContractTermEntry({
      id: 't1',
      packageId: 'p1',
      projectId: 7,
      candidateId: 'c1',
      documentId: 'd1',
      term: 'ld_rate',
      label: 'LD rate',
      value: '0.5% of the Contract Price per week',
      clause: '47.1',
      sourceClass: 'SCC',
      riskId: null,
      updatedAt: '2026-11-09T08:00:00Z',
      somethingNew: true,
    });
    expect(t).toMatchObject({ term: 'ld_rate', label: 'LD rate', clause: '47.1', sourceClass: 'SCC', projectId: 7 });
    expect(t.riskId).toBeUndefined();
    expect(parseContractTermEntry({ id: 't2', term: 'dlp' }).label).toBe('dlp');
  });

  test('coverage keeps every value found, the overridden one marked, and the pages searched', () => {
    const c = parseContractTermCoverage({
      notice: null,
      read: [
        {
          documentId: 'd1',
          segmentId: 's1',
          fileName: 'Conditions of Contract.pdf',
          docClass: 'GCC',
          status: 'EXTRACTED',
          pagesSearched: '12-48',
          pagesNotRead: [30],
        },
      ],
      terms: [
        {
          term: 'ld_rate',
          label: 'LD rate',
          status: 'FOUND',
          proposedCandidateId: 'c2',
          found: [
            { candidateId: 'c1', value: '0.5%', clause: '47.1', docClass: 'GCC', status: 'PROPOSED', overridden: true },
            { candidateId: 'c2', value: '1%', docClass: 'SCC', status: 'PROPOSED', overridden: false, supersedesCandidateId: 'c1' },
          ],
        },
        { term: 'insurance', label: 'Insurance', status: 'NOT_FOUND', message: 'Not found on pages 12-48.' },
        { term: 'escalation', status: 'SOMETHING_NEW' },
      ],
    });
    expect(c.notice).toBeUndefined();
    expect(c.read[0]).toMatchObject({ pagesSearched: '12-48', pagesNotRead: [30] });
    expect(c.terms[0].found.map((f) => f.overridden)).toEqual([true, false]);
    expect(c.terms[0].found[1].supersedesCandidateId).toBe('c1');
    expect(c.terms[1]).toMatchObject({ status: 'NOT_FOUND', found: [] });
    expect(c.terms[2].label).toBe('escalation');
    expect(parseContractTermCoverage({}).terms).toEqual([]);
  });

  test('an obligation entry keeps its deadline in days when the backend gave one', () => {
    const o = parseObligationEntry({
      id: 'o1',
      candidateId: 'c1',
      clause: '52.1',
      deadline: '21 days',
      deadlineDays: 21,
      responsibleParty: 'Contractor',
      trigger: 'receipt of the Letter of Acceptance',
      requiredDocument: 'Performance Security',
      topic: 'performance security',
    });
    expect(o).toMatchObject({ deadline: '21 days', deadlineDays: 21, responsibleParty: 'Contractor' });
    expect(parseObligationEntry({ id: 'o2', deadline: 'promptly' }).deadlineDays).toBeUndefined();
  });

  test('a raised risk reads created as false unless the backend says true', () => {
    expect(parseRaisedRisk({ riskId: 'r1', riskNumber: 'R-007', projectId: 7, created: true })).toEqual({
      riskId: 'r1',
      riskNumber: 'R-007',
      projectId: 7,
      created: true,
    });
    expect(parseRaisedRisk({ riskId: 'r1' }).created).toBe(false);
  });

  test('the term and obligation readers never throw and the general term carries the override flag', () => {
    const general = candidate(
      'CONTRACT_TERM',
      'ld_rate',
      { value: '0.5% per week', clause: 47.1 },
      { flags: [{ code: INGEST_FLAG.OVERRIDDEN_BY_SCC, message: 'The special conditions restate this term.' }] }
    );
    expect(contractTermOf(general)).toEqual({ term: 'ld_rate', value: '0.5% per week', clause: '47.1' });
    expect(hasFlag(general, 'OVERRIDDEN_BY_SCC')).toBe(true);
    expect(contractTermOf(candidate('CONTRACT_TERM', 'dlp', { value: { odd: 1 } })).value).toBeUndefined();

    const o = obligationOf(
      candidate('OBLIGATION', '52.1|21 days', {
        clause: '52.1',
        deadline: '21 days',
        responsible_party: 'Contractor',
        topic: 'performance security',
        required_document: 'Performance Security',
      })
    );
    expect(o).toMatchObject({ deadline: '21 days', responsibleParty: 'Contractor', requiredDocument: 'Performance Security' });
    expect(o.financialImpact).toBeUndefined();
  });
});

describe('drawings', () => {
  const entry = {
    id: 'w1',
    packageId: 'p1',
    projectId: 7,
    candidateId: 'c1',
    documentId: 'd1',
    drawingNumber: 'RCB-AR-101',
    title: 'Ground floor plan',
    discipline: 'AR',
    revision: 'C',
    revisionDate: '2026-03-01',
    revisionDateText: '01.03.2026',
    scale: '1:100',
    sheetPage: 4,
    layout: null,
    sourceFormat: 'PDF',
    status: 'READ',
    current: true,
    supersedesId: 'w0',
    supersededById: null,
    cropAvailable: true,
    revisionHistory: [{ revision: 'A', date: '2026-01-10', description: 'First issue' }, 'not an object'],
    note: null,
    updatedAt: '2026-11-09T08:00:00Z',
  };

  test('a register row parses with its revision chain links', () => {
    const d = parseDrawingEntry(entry);
    expect(d).toMatchObject({ drawingNumber: 'RCB-AR-101', revision: 'C', current: true, supersedesId: 'w0', cropAvailable: true });
    expect(d.supersededById).toBeUndefined();
    expect(d.revisionHistory).toEqual([{ revision: 'A', date: '2026-01-10', description: 'First issue' }, {}]);
  });

  test('a row with an unknown status reads as not read', () => {
    expect(parseDrawingEntry({ id: 'w2', status: 'PENDING' }).status).toBe('NOT_READ');
    expect(parseDrawingEntry({ id: 'w3' })).toMatchObject({ current: false, cropAvailable: false, revisionHistory: [] });
  });

  test('the drawing reader takes the title block from the payload and the number from the key when absent', () => {
    const d = drawingOf(
      candidate('DRAWING', 'RCB-ST-201', {
        title: 'Footing layout',
        revision: 'B',
        sheet_page: 2,
        source_format: 'PDF',
        revision_history: [{ revision: 'A', date: '2026-02-01' }],
      })
    );
    expect(d).toMatchObject({ drawingNumber: 'RCB-ST-201', title: 'Footing layout', revision: 'B', sheetPage: 2, sourceFormat: 'PDF' });
    expect(d.revisionHistory).toEqual([{ revision: 'A', date: '2026-02-01', description: undefined }]);
    expect(drawingOf(candidate('DRAWING', 'X', { revision_history: 'garbled' })).revisionHistory).toEqual([]);
  });
});

describe('quality requirements', () => {
  test('an ITP row keeps its lists and drops what is not text', () => {
    const q = parseQualityRequirementEntry({
      id: 'q1',
      packageId: 'p1',
      projectId: 7,
      candidateId: 'c1',
      documentId: 'd1',
      subject: 'Concrete M25',
      activity: 'Concreting',
      material: 'Concrete',
      grade: 'M25',
      standards: ['IS 456', 'IS 516', 3],
      test: 'Cube compressive strength',
      frequency: null,
      acceptanceCriterion: 'Not less than 25 N/mm2 at 28 days',
      holdOrWitnessPoint: 'Hold point before pour',
      requiredDocuments: ['Cube test report'],
      notStated: ['frequency'],
      tradeId: 'tr1',
      tradeCode: 'CONC',
      tradeName: 'Concrete',
      citations: [{ id: 's1', field: 'grade', page: 12, quote: 'Concrete shall be of grade M25.' }],
    });
    expect(q.standards).toEqual(['IS 456', 'IS 516']);
    expect(q.frequency).toBeUndefined();
    expect(q.notStated).toEqual(['frequency']);
    expect(q.citations[0].page).toBe(12);
    expect(q.templateId).toBeUndefined();
    expect(parseQualityRequirementEntry({ id: 'q2', material: 'Steel' }).subject).toBe('Steel');
  });

  test('the quality reader reads the snake-case payload and a single standard as a list', () => {
    const q = qualityRequirementOf(
      candidate(
        'QUALITY_REQUIREMENT',
        'Concrete M25',
        {
          activity: 'Concreting',
          material: 'Concrete',
          grade: 'M25',
          standards: 'IS 456',
          test: 'Slump',
          acceptance_criterion: '75 to 100 mm',
          hold_or_witness_point: 'Witness',
          required_documents: ['Slump record', ''],
        },
        { flags: [{ code: INGEST_FLAG.FREQUENCY_NOT_STATED, message: 'No frequency is stated.' }] }
      )
    );
    expect(q).toMatchObject({
      subject: 'Concrete M25',
      standards: ['IS 456'],
      acceptanceCriterion: '75 to 100 mm',
      holdOrWitnessPoint: 'Witness',
      requiredDocuments: ['Slump record'],
    });
    expect(q.frequency).toBeUndefined();
    expect(qualityRequirementOf(candidate('QUALITY_REQUIREMENT', 'Steel', {})).standards).toEqual([]);
  });

  test('a copy reports each row, and an unknown outcome never reads as copied', () => {
    const r = parseCopyToTemplateResult({
      rows: [
        { requirementId: 'q1', outcome: 'COPIED', templateId: 't1', templateItemId: 'i1' },
        { requirementId: 'q2', outcome: 'NO_TRADE', message: 'No trade matched.' },
        { requirementId: 'q3', outcome: 'SOMETHING_NEW' },
      ],
      templates: [
        { templateId: 't1', templateName: 'Concrete checks', tradeId: 'tr1', tradeName: 'Concrete', version: 3, active: true, created: false, itemsAdded: 1 },
      ],
    });
    expect(r.rows.map((x) => x.outcome as string)).toEqual(['COPIED', 'NO_TRADE', 'SOMETHING_NEW']);
    expect(parseCopyToTemplateResult({ rows: [{ requirementId: 'q4' }] }).rows[0].outcome).toBe('NOT_FOUND');
    expect(r.templates[0]).toMatchObject({ version: 3, itemsAdded: 1, created: false });
  });
});

describe('qualification and the compliance matrix', () => {
  test('a requirement entry keeps a person status only when it is a matrix status', () => {
    const q = parseQualificationRequirementEntry({
      id: 'r1',
      packageId: 'p1',
      candidateId: 'c1',
      documentId: 'd1',
      requirement: 'turnover',
      label: 'Turnover',
      value: 'INR 12 crore',
      period: 'last three financial years',
      comparedAutomatically: true,
      personStatus: null,
    });
    expect(q).toMatchObject({ requirement: 'turnover', value: 'INR 12 crore', comparedAutomatically: true });
    expect(q.personStatus).toBeUndefined();
    expect(parseQualificationRequirementEntry({ id: 'r2', personStatus: 'GAP' }).personStatus).toBe('GAP');
    expect(parseQualificationRequirementEntry({ id: 'r3', personStatus: 'MAYBE' }).personStatus).toBeUndefined();
  });

  test('a matrix row with an unknown status reads as UNKNOWN', () => {
    const m = parseComplianceMatrix({
      packageId: 'p1',
      stage: 'TENDER',
      shown: true,
      rows: [
        {
          requirementId: 'r1',
          requirement: 'turnover',
          label: 'Turnover',
          tenderValue: 'INR 12 crore',
          companyValue: 'INR 15 crore',
          status: 'MATCH',
          basis: 'COMPARED',
          evidence: [{ id: 'e1', fileName: 'Audited accounts.pdf', label: null }],
        },
        { requirementId: 'r2', requirement: 'equipment', tenderValue: 'Two tower cranes', status: 'LATER', basis: 'AWAITING_PERSON' },
      ],
    });
    expect(m.rows[0]).toMatchObject({ status: 'MATCH', companyValue: 'INR 15 crore' });
    expect(m.rows[0].evidence).toEqual([{ id: 'e1', fileName: 'Audited accounts.pdf', label: undefined }]);
    expect(m.rows[1]).toMatchObject({ status: 'UNKNOWN', label: 'equipment', basis: 'AWAITING_PERSON' });
    expect(parseComplianceMatrix({ packageId: 'p1', shown: false, notice: 'Shown at tender stage only.' })).toMatchObject({
      shown: false,
      notice: 'Shown at tender stage only.',
      rows: [],
    });
  });

  test('the qualification reader takes the type from the natural key', () => {
    expect(qualificationRequirementKeyOf('similar_projects|3')).toBe('similar_projects');
    expect(qualificationRequirementKeyOf('Turnover')).toBe('turnover');
    expect(qualificationRequirementKeyOf(undefined)).toBeUndefined();
    const q = qualificationRequirementOf(
      candidate('QUALIFICATION_REQUIREMENT', 'similar_projects|1', { value: 3, min_value: 'INR 4 crore each', period: 'last seven years' })
    );
    expect(q).toEqual({ requirement: 'similar_projects', value: '3', minValue: 'INR 4 crore each', period: 'last seven years' });
    expect(isQualificationSetByPerson('personnel')).toBe(true);
    expect(isQualificationSetByPerson('turnover')).toBe(false);
  });

  test('a company profile parses its sections, and an empty one reads as unsaved', () => {
    const p = parseCompanyProfile({
      id: 'cp1',
      yearsInBusiness: 11,
      turnover: [{ financialYear: '2025-26', amount: '150000000.00' }],
      similarProjects: [{ name: 'Harbour View Apartments', client: 'Northwind Estates', value: 42000000, completedYear: 2024 }],
      equipment: [{ name: 'Tower crane', quantity: 2 }],
      personnel: [{ role: 'Project manager', experienceYears: 15 }],
      evidence: [
        { id: 'e1', section: 'TURNOVER', fileName: 'Audited accounts.pdf', contentType: 'application/pdf', sizeBytes: 2048, uploaded: true },
      ],
      updatedBy: 3,
    });
    expect(p.turnover[0]).toEqual({ financialYear: '2025-26', amount: 150000000 });
    expect(p.similarProjects[0]).toMatchObject({ name: 'Harbour View Apartments', value: 42000000, completedYear: 2024 });
    expect(p.equipment[0].details).toBeUndefined();
    expect(p.evidence[0]).toMatchObject({ section: 'TURNOVER', uploaded: true });
    const empty = parseCompanyProfile({ id: null, turnover: [], evidence: [] });
    expect(empty.id).toBeUndefined();
    expect(empty).toMatchObject({ turnover: [], similarProjects: [], equipment: [], personnel: [] });
  });

  test('an evidence upload carries its presigned PUT', () => {
    const u = parseEvidenceUpload({
      evidenceId: 'e1',
      upload: { key: 'org/1/evidence/e1', url: 'https://store.example/put', contentType: 'application/pdf', expiresInSeconds: 600 },
    });
    expect(u.evidenceId).toBe('e1');
    expect(u.upload.key).toBe('org/1/evidence/e1');
  });
});
