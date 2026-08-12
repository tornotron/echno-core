import { describe, expect, test } from 'bun:test';
import { parsePayment } from './payment';

const UUID = '11111111-1111-1111-1111-111111111111';

// The backend may serialize a BigDecimal money field as a string. The boundary
// now coerces it to a number instead of passing the string through (which broke
// arithmetic) or fabricating 0.
describe('parsePayment money coercion', () => {
  test('coerces a string-serialized amount to a number', () => {
    const payment = parsePayment({ id: UUID, amount: '1500.50' });
    expect(payment.amount).toBe(1500.5);
  });

  test('accepts a numeric amount', () => {
    expect(parsePayment({ id: UUID, amount: 42 }).amount).toBe(42);
  });

  test('defaults a missing amount to 0', () => {
    expect(parsePayment({ id: UUID }).amount).toBe(0);
  });

  test('rejects a non-numeric amount instead of yielding NaN', () => {
    expect(() => parsePayment({ id: UUID, amount: 'not-a-number' })).toThrow();
  });
});
