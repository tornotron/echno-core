import { describe, expect, test } from 'bun:test';
import {
  parseCostCategory,
  createCostCategoryToJson,
  updateCostCategoryToJson,
} from './cost-category';

const UUID = '55555555-5555-5555-5555-555555555555';
const ACCOUNT_UUID = '66666666-6666-6666-6666-666666666666';

describe('parseCostCategory', () => {
  test('parses a full category', () => {
    const category = parseCostCategory({
      id: UUID,
      name: 'Labour',
      code: 'CC-100',
      expenseAccountId: ACCOUNT_UUID,
      expenseAccountCode: '5000',
      active: true,
    });
    expect(category.id).toBe(UUID);
    expect(category.name).toBe('Labour');
    expect(category.code).toBe('CC-100');
    expect(category.expenseAccountId).toBe(ACCOUNT_UUID);
    expect(category.expenseAccountCode).toBe('5000');
    expect(category.active).toBe(true);
  });

  test('defaults missing nullable fields to null and active to true', () => {
    const category = parseCostCategory({ id: UUID, name: 'Materials' });
    expect(category.code).toBeNull();
    expect(category.expenseAccountId).toBeNull();
    expect(category.expenseAccountCode).toBeNull();
    expect(category.active).toBe(true);
  });

  test('throws when id is missing', () => {
    expect(() => parseCostCategory({ name: 'Labour' })).toThrow();
  });
});

describe('createCostCategoryToJson', () => {
  test('emits name and only set optionals', () => {
    expect(
      createCostCategoryToJson({ name: 'Labour', expenseAccountId: ACCOUNT_UUID })
    ).toEqual({ name: 'Labour', expenseAccountId: ACCOUNT_UUID });
  });

  test('omits unset optionals', () => {
    expect(createCostCategoryToJson({ name: 'Labour' })).toEqual({
      name: 'Labour',
    });
  });
});

describe('updateCostCategoryToJson', () => {
  test('emits name and active plus set optionals', () => {
    expect(
      updateCostCategoryToJson({
        name: 'Labour',
        active: false,
        code: 'CC-100',
      })
    ).toEqual({ name: 'Labour', active: false, code: 'CC-100' });
  });
});
