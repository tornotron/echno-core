import { describe, expect, test } from 'bun:test';
import { parseCompanyBankAccount } from './company-bank-account';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('parseCompanyBankAccount', () => {
  test('parses a minimal account', () => {
    const account = parseCompanyBankAccount({
      id: UUID,
      bankName: 'HDFC',
      isDefault: true,
    });
    expect(account.id).toBe(UUID);
    expect(account.bankName).toBe('HDFC');
    expect(account.isDefault).toBe(true);
    expect(account.active).toBe(true);
  });

  test('throws when id is missing', () => {
    expect(() => parseCompanyBankAccount({ bankName: 'HDFC' })).toThrow();
  });
});
