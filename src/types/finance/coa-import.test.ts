import { describe, expect, test } from 'bun:test';
import { parseCoaImportSummary } from './coa-import';

describe('parseCoaImportSummary', () => {
  test('parses a full summary', () => {
    const summary = parseCoaImportSummary({
      created: 3,
      updated: 2,
      errors: ['row 5: bad type'],
    });
    expect(summary.created).toBe(3);
    expect(summary.updated).toBe(2);
    expect(summary.errors).toEqual(['row 5: bad type']);
  });

  test('defaults counts to 0 and errors to []', () => {
    const summary = parseCoaImportSummary({});
    expect(summary.created).toBe(0);
    expect(summary.updated).toBe(0);
    expect(summary.errors).toEqual([]);
  });
});
