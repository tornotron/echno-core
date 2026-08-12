import { describe, expect, test } from 'bun:test';
import { parseIndent } from './indent';
import { IndentStatus } from './enums';

describe('parseIndent', () => {
  test('parses a minimal valid payload', () => {
    const indent = parseIndent({
      id: 4,
      indentNumber: 'IND-002',
      createdAt: '2026-02-01T10:00:00Z',
      createdBy: { id: 6, employeeName: 'Ravi' },
      status: 'PENDING',
    });
    expect(indent.id).toBe(4);
    expect(indent.createdBy.name).toBe('Ravi');
    expect(indent.status).toBe(IndentStatus.pending);
    expect(indent.items).toEqual([]);
  });

  test('throws when createdBy.id is missing', () => {
    expect(() =>
      parseIndent({ id: 4, createdBy: {}, status: 'PENDING' })
    ).toThrow();
  });
});
