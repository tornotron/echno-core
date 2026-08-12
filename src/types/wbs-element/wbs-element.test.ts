import { describe, expect, test } from 'bun:test';
import { parseWbsElement } from './wbs-element';

describe('parseWbsElement', () => {
  test('parses a minimal payload and coerces the budget', () => {
    const el = parseWbsElement({
      id: 3,
      projectId: 9,
      name: 'Foundation',
      allocatedBudget: '5000',
    });
    expect(el.id).toBe(3);
    expect(el.projectId).toBe(9);
    expect(el.name).toBe('Foundation');
    expect(el.allocatedBudget).toBe(5000);
  });

  test('throws when projectId is missing', () => {
    expect(() => parseWbsElement({ id: 3, name: 'Foundation' })).toThrow();
  });
});
