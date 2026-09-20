import { describe, expect, test } from 'bun:test';
import { parseIndentSummary } from './indent-summary';
import { IndentStatus } from './enums';

describe('parseIndentSummary', () => {
  test('parses an IndentSummaryDto payload', () => {
    const summary = parseIndentSummary({
      id: 42,
      indentNumber: 'IND-2026-0015',
      createdAt: '2026-01-15T09:00:00',
      createdById: 18,
      createdByName: 'Ramesh Kumar',
      projectId: 3,
      projectName: 'Phase 2',
      status: 'PENDING',
      expectedOn: '2026-02-05T00:00:00',
      remarks: 'before the slab pour',
      itemCount: 10,
      convertedItemCount: 4,
    });
    expect(summary.id).toBe(42);
    expect(summary.indentNumber).toBe('IND-2026-0015');
    expect(summary.createdBy).toEqual({ id: 18, name: 'Ramesh Kumar' });
    expect(summary.projectId).toBe(3);
    expect(summary.projectName).toBe('Phase 2');
    expect(summary.status).toBe(IndentStatus.pending);
    expect(summary.itemCount).toBe(10);
    expect(summary.convertedItemCount).toBe(4);
  });

  test('a raiser no longer recorded reads as id 0, and absent counts as zero', () => {
    const summary = parseIndentSummary({
      id: 3,
      indentNumber: 'IND-1',
      createdById: null,
      createdByName: null,
      items: [{ id: 1 }],
    });
    expect(summary.createdBy).toEqual({ id: 0, name: '' });
    expect(summary.itemCount).toBe(0);
    expect(summary.convertedItemCount).toBe(0);
    expect('items' in summary).toBe(false);
  });

  test('rejects a missing id', () => {
    expect(() => parseIndentSummary({ indentNumber: 'x' })).toThrow();
  });
});
