import { describe, expect, test } from 'bun:test';
import { parseWorkCategory } from './work-category';

describe('parseWorkCategory', () => {
  test('parses a payload and generates an icon fallback from the name', () => {
    const cat = parseWorkCategory({ id: 4, name: 'Civil Engineering' });
    expect(cat.id).toBe(4);
    expect(cat.name).toBe('Civil Engineering');
    expect(cat.icon).toBe('CE');
  });

  test('throws when id is missing', () => {
    expect(() => parseWorkCategory({ name: 'Civil' })).toThrow();
  });
});
