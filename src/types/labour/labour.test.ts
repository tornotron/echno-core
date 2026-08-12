import { describe, expect, test } from 'bun:test';
import { parseLabour } from './labour';

// The boundary validates the payload shape: a valid id and fields come
// through (with a string-serialized rate coerced to a number), while a
// non-positive id fails fast instead of yielding a fabricated value.
describe('parseLabour', () => {
  test('parses a minimal valid payload and coerces a string rate', () => {
    const labour = parseLabour({
      id: 7,
      fullName: 'Ravi Kumar',
      dailyRate: '500.5',
    });
    expect(labour.id).toBe(7);
    expect(labour.fullName).toBe('Ravi Kumar');
    expect(labour.dailyRate).toBe(500.5);
  });

  test('rejects a non-positive id', () => {
    expect(() => parseLabour({ id: -1 })).toThrow();
  });
});
