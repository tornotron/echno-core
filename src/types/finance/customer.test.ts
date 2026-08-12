import { describe, expect, test } from 'bun:test';
import { parseCustomer } from './customer';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('parseCustomer', () => {
  test('parses a customer and coerces a string credit limit', () => {
    const customer = parseCustomer({
      id: UUID,
      code: 'CUST-1',
      name: 'Asset Homes',
      creditLimit: '50000.00',
      billingAddress: { city: 'Kochi' },
    });
    expect(customer.code).toBe('CUST-1');
    expect(customer.creditLimit).toBe(50000);
    expect(customer.billingAddress?.city).toBe('Kochi');
  });

  test('throws when id is missing', () => {
    expect(() => parseCustomer({ code: 'CUST-1' })).toThrow();
  });
});
