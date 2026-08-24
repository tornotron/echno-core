import { describe, expect, test } from 'bun:test';
import {
  parseBudgetAllocation,
  upsertBudgetAllocationToJson,
} from './budget-allocation';

const UUID = '77777777-7777-7777-7777-777777777777';
const CATEGORY_UUID = '88888888-8888-8888-8888-888888888888';

describe('parseBudgetAllocation', () => {
  test('parses a full allocation and coerces a string amount', () => {
    const allocation = parseBudgetAllocation({
      id: UUID,
      projectId: 7,
      costCategoryId: CATEGORY_UUID,
      costCategoryName: 'Labour',
      allocatedAmount: '15000.00',
    });
    expect(allocation.id).toBe(UUID);
    expect(allocation.projectId).toBe(7);
    expect(allocation.costCategoryId).toBe(CATEGORY_UUID);
    expect(allocation.costCategoryName).toBe('Labour');
    expect(allocation.allocatedAmount).toBe(15000);
  });

  test('defaults a missing amount to 0', () => {
    const allocation = parseBudgetAllocation({
      id: UUID,
      projectId: 1,
      costCategoryId: CATEGORY_UUID,
    });
    expect(allocation.allocatedAmount).toBe(0);
    expect(allocation.costCategoryName).toBe('');
  });

  test('throws when costCategoryId is missing', () => {
    expect(() =>
      parseBudgetAllocation({ id: UUID, projectId: 1 })
    ).toThrow();
  });
});

describe('upsertBudgetAllocationToJson', () => {
  test('emits allocatedAmount', () => {
    expect(upsertBudgetAllocationToJson({ allocatedAmount: 500 })).toEqual({
      allocatedAmount: 500,
    });
  });
});
