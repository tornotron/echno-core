import { describe, expect, test } from 'bun:test';
import { parseUser } from './user';

// The parse boundary now validates the backend payload with zod: a structurally
// wrong response fails fast with the offending field, instead of flowing through
// as a fabricated value.
describe('parseUser boundary validation', () => {
  test('parses a valid response and defaults absent optional fields', () => {
    const user = parseUser({ id: 1, name: 'Asha', email: 'asha@example.test' });

    expect(user.id).toBe(1);
    expect(user.name).toBe('Asha');
    expect(user.address).toBe('Not Specified');
  });

  test('coerces a numeric-string id', () => {
    expect(parseUser({ id: '42' }).id).toBe(42);
  });

  test('rejects a missing id', () => {
    expect(() => parseUser({ name: 'x' })).toThrow();
  });

  test('rejects a non-positive id', () => {
    expect(() => parseUser({ id: 0 })).toThrow();
    expect(() => parseUser({ id: -3 })).toThrow();
  });

  test('rejects a wrong-typed field instead of using it', () => {
    expect(() => parseUser({ id: 1, name: 123 })).toThrow();
  });
});
