import { describe, expect, test } from 'bun:test';
import {
  parseConstructionPayment,
  ConstructionPaymentType,
  ConstructionPaymentVoucherStatus,
  ConstructionPaymentMethod,
} from './construction-payment';

const UUID = '11111111-1111-1111-1111-111111111111';

// The backend serializes the BigDecimal amount as a string; the boundary
// coerces it to a number instead of passing the string through (which broke
// arithmetic) or fabricating 0.
describe('parseConstructionPayment', () => {
  test('parses a valid payload with enums', () => {
    const payment = parseConstructionPayment({
      id: UUID,
      paymentNumber: 'CPMT-001',
      type: 'INVOICE',
      status: 'COMPLETED',
      method: 'BANK_TRANSFER',
      payeeType: 'VENDOR',
      projectId: 4,
      amount: '9000.00',
    });
    expect(payment.id).toBe(UUID);
    expect(payment.type).toBe(ConstructionPaymentType.INVOICE);
    expect(payment.status).toBe(ConstructionPaymentVoucherStatus.COMPLETED);
    expect(payment.method).toBe(ConstructionPaymentMethod.BANK_TRANSFER);
    expect(payment.projectId).toBe(4);
  });

  test('coerces a string-serialized amount to a number', () => {
    const payment = parseConstructionPayment({
      id: UUID,
      projectId: 1,
      amount: '1500.50',
    });
    expect(payment.amount).toBe(1500.5);
  });

  test('defaults a missing amount to 0', () => {
    expect(
      parseConstructionPayment({ id: UUID, projectId: 1 }).amount
    ).toBe(0);
  });

  test('falls back to default enums on an unknown value', () => {
    const payment = parseConstructionPayment({
      id: UUID,
      projectId: 1,
      status: 'BOGUS',
    });
    expect(payment.status).toBe(ConstructionPaymentVoucherStatus.PENDING);
    expect(payment.type).toBe(ConstructionPaymentType.OTHER);
  });

  test('rejects a missing id instead of fabricating one', () => {
    expect(() => parseConstructionPayment({ projectId: 1 })).toThrow();
  });

  test('rejects a non-numeric amount instead of yielding NaN', () => {
    expect(() =>
      parseConstructionPayment({ id: UUID, projectId: 1, amount: 'not-a-number' })
    ).toThrow();
  });
});
