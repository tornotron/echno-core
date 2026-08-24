import { describe, expect, test } from 'bun:test';
import {
  parseProjectCostControl,
  parseProjectCostControlLine,
} from './project-cost-control';

const CATEGORY_UUID = '99999999-9999-9999-9999-999999999999';

describe('parseProjectCostControlLine', () => {
  test('parses a category row and coerces string money', () => {
    const line = parseProjectCostControlLine({
      costCategoryId: CATEGORY_UUID,
      costCategoryName: 'Labour',
      allocated: '10000.00',
      committed: '4000.00',
      spent: '3500.00',
      remaining: '6000.00',
      overBudget: false,
    });
    expect(line.costCategoryId).toBe(CATEGORY_UUID);
    expect(line.costCategoryName).toBe('Labour');
    expect(line.allocated).toBe(10000);
    expect(line.committed).toBe(4000);
    expect(line.spent).toBe(3500);
    expect(line.remaining).toBe(6000);
    expect(line.overBudget).toBe(false);
  });

  test('keeps a null costCategoryId on the total row', () => {
    const line = parseProjectCostControlLine({
      costCategoryId: null,
      costCategoryName: 'Total',
      allocated: 10000,
      overBudget: true,
    });
    expect(line.costCategoryId).toBeNull();
    expect(line.costCategoryName).toBe('Total');
    expect(line.overBudget).toBe(true);
    expect(line.committed).toBe(0);
  });
});

describe('parseProjectCostControl', () => {
  test('parses categories and the totals row', () => {
    const report = parseProjectCostControl({
      projectId: 7,
      categories: [
        {
          costCategoryId: CATEGORY_UUID,
          costCategoryName: 'Labour',
          allocated: 10000,
          committed: 4000,
          spent: 3500,
          remaining: 6000,
          overBudget: false,
        },
      ],
      totals: {
        costCategoryId: null,
        costCategoryName: 'Total',
        allocated: 10000,
        committed: 4000,
        spent: 3500,
        remaining: 6000,
        overBudget: false,
      },
    });
    expect(report.projectId).toBe(7);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0]!.costCategoryName).toBe('Labour');
    expect(report.totals.costCategoryId).toBeNull();
    expect(report.totals.costCategoryName).toBe('Total');
  });

  test('defaults missing categories and totals', () => {
    const report = parseProjectCostControl({ projectId: 1 });
    expect(report.categories).toEqual([]);
    expect(report.totals.costCategoryId).toBeNull();
    expect(report.totals.allocated).toBe(0);
  });
});
