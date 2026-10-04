import { describe, expect, test } from 'bun:test';
import { parseWorkSubcategory } from './work-subcategory';

describe('parseWorkSubcategory', () => {
  test('parses a full payload', () => {
    expect(
      parseWorkSubcategory({
        id: 12,
        categoryId: 2,
        name: 'Excavation',
        description: 'Digging to the required depth.',
      })
    ).toEqual({
      id: 12,
      categoryId: 2,
      name: 'Excavation',
      description: 'Digging to the required depth.',
    });
  });

  test('reads a null description as absent', () => {
    expect(
      parseWorkSubcategory({ id: 3, categoryId: 2, name: 'Backfilling', description: null })
        .description
    ).toBeUndefined();
  });

  test('throws without an id', () => {
    expect(() => parseWorkSubcategory({ categoryId: 2, name: 'Backfilling' })).toThrow();
  });
});
