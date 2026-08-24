import { describe, expect, test } from 'bun:test';
import {
  parsePostingAccountMapping,
  upsertPostingAccountMappingToJson,
} from './posting-account';
import { PostingRole, PostingAccountSource } from './finance-enums';

const UUID = '22222222-2222-2222-2222-222222222222';

describe('parsePostingAccountMapping', () => {
  test('parses a full mapping', () => {
    const mapping = parsePostingAccountMapping({
      role: 'ACCOUNTS_RECEIVABLE',
      source: 'MAPPED',
      accountId: UUID,
      accountCode: '1100',
      accountName: 'Trade Debtors',
    });
    expect(mapping.role).toBe(PostingRole.ACCOUNTS_RECEIVABLE);
    expect(mapping.source).toBe(PostingAccountSource.MAPPED);
    expect(mapping.accountId).toBe(UUID);
    expect(mapping.accountCode).toBe('1100');
    expect(mapping.accountName).toBe('Trade Debtors');
  });

  test('defaults an unknown source to DEFAULT', () => {
    const mapping = parsePostingAccountMapping({
      role: 'GST_OUTPUT',
      source: 'WHATEVER',
      accountId: UUID,
    });
    expect(mapping.source).toBe(PostingAccountSource.DEFAULT);
    expect(mapping.accountCode).toBe('');
  });

  test('throws when accountId is missing', () => {
    expect(() =>
      parsePostingAccountMapping({ role: 'GST_INPUT', source: 'DEFAULT' })
    ).toThrow();
  });
});

describe('upsertPostingAccountMappingToJson', () => {
  test('emits accountId', () => {
    expect(upsertPostingAccountMappingToJson({ accountId: UUID })).toEqual({
      accountId: UUID,
    });
  });
});
