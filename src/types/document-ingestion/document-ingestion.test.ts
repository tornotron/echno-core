import { describe, expect, test } from 'bun:test';
import {
  boqItemOf,
  parseBoqSheet,
  parseCandidate,
  parseIngestDocument,
  parseIngestPackage,
  parseIngestPage,
  sourceOf,
} from './document-ingestion';

const boqCandidate = {
  id: 'c1',
  packageId: 'p1',
  documentId: 'd1',
  segmentId: 'seg1',
  kind: 'BOQ_ITEM',
  naturalKey: 'BOQ!4',
  payload: {
    itemCode: '1.03',
    description: 'RCC M25',
    unit: 'm³',
    quantity: '850',
    rate: '9800',
    amount: '8330000',
    section: null,
    sheet: 'BOQ',
    sheetIndex: 0,
    row: 4,
  },
  acceptedPayload: null,
  flags: [{ code: 'NUMBER_AS_TEXT', message: 'The rate is a number held as text' }],
  acknowledgedFlags: null,
  method: 'DETERMINISTIC',
  status: 'PROPOSED',
  sources: [
    { id: 'r1', field: 'quantity', documentId: 'd1', sheet: 'BOQ', rowNumber: 4, cell: 'D4', quote: '850', quoteVerified: true },
  ],
  somethingNew: 'ignored',
};

describe('document ingestion parsers', () => {
  test('a BOQ candidate keeps its numbers as decimal strings', () => {
    const c = parseCandidate(boqCandidate);
    const item = boqItemOf(c);
    expect(item.quantity).toBe('850');
    expect(item.amount).toBe('8330000');
    expect(item.row).toBe(4);
    expect(item.section).toBeUndefined();
    expect(c.acknowledgedFlags).toEqual([]);
    expect(sourceOf(c, 'quantity')?.cell).toBe('D4');
    expect(sourceOf(c, 'rate')).toBeUndefined();
  });

  test('the accepted payload wins over the extracted one', () => {
    const c = parseCandidate({ ...boqCandidate, acceptedPayload: { ...boqCandidate.payload, quantity: '851' } });
    expect(boqItemOf(c).quantity).toBe('851');
    expect(c.payload.quantity).toBe('850');
  });

  test('a package with no target and a numeric id parses', () => {
    const p = parseIngestPackage({ id: 5, name: 'Tender', subContractId: null });
    expect(p.id).toBe('5');
    expect(p.subContractId).toBeUndefined();
    expect(p.stage).toBe('TENDER');
    expect(p.documentCount).toBe(0);
  });

  test('a document with its latest job parses, and an unknown status reads as being read', () => {
    const d = parseIngestDocument({
      id: 'd1',
      packageId: 'p1',
      fileName: 'BOQ.xlsx',
      fileType: 'XLSX',
      sizeBytes: 10,
      status: null,
      latestJob: { id: 'j1', jobType: 'PARSE', status: 'RUNNING', attempt: 1, maxAttempts: 3 },
    });
    expect(d.status).toBe('QUEUED');
    expect(d.latestJob?.status).toBe('RUNNING');
  });

  test('a BOQ sheet drops columns of fields it does not know', () => {
    const s = parseBoqSheet({
      id: 's1',
      documentId: 'd1',
      sheetName: 'BOQ',
      sheetIndex: 0,
      status: 'EXTRACTED',
      headerRow: 2,
      columns: { description: 2, quantity: 4, colour: 9 },
      preview: [{ row: 1, hidden: false, cells: [{ col: 1, ref: 'A1', text: 'Item' }] }],
      rowCount: 3,
      summary: { rowsRead: 3, items: 2, sections: 1, totals: 0, flaggedItems: 1, ignoredRows: [], warnings: [{ code: 'NO_ITEMS', message: 'x' }] },
    });
    expect(s.columns).toEqual({ description: 2, quantity: 4 });
    expect(s.preview[0].cells[0].ref).toBe('A1');
    expect(s.summary?.warnings[0].row).toBeUndefined();
  });

  test('a page reads either index spelling', () => {
    expect(parseIngestPage({ content: [{ id: 1 }], number: 3 }, parseIngestPackage).page).toBe(3);
    expect(parseIngestPage({ content: [] }, parseIngestPackage).totalPages).toBe(0);
  });

  test('a candidate with no id is refused', () => {
    expect(() => parseCandidate({ kind: 'BOQ_ITEM' })).toThrow();
  });
});
