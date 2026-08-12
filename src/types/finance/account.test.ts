import { describe, expect, test } from 'bun:test';
import { parseAccount } from './account';
import { AccountType } from './finance-enums';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('parseAccount', () => {
  test('parses a minimal account', () => {
    const account = parseAccount({ id: UUID, code: '1000', type: 'LIABILITY' });
    expect(account.id).toBe(UUID);
    expect(account.code).toBe('1000');
    expect(account.type).toBe(AccountType.LIABILITY);
    expect(account.active).toBe(true);
  });

  test('throws when id is missing', () => {
    expect(() => parseAccount({ code: '1000' })).toThrow();
  });
});
