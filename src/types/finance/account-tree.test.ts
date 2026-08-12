import { describe, expect, test } from 'bun:test';
import { parseAccountTree } from './account-tree';
import { AccountType } from './finance-enums';

const UUID = '11111111-1111-1111-1111-111111111111';
const CHILD = '22222222-2222-2222-2222-222222222222';

describe('parseAccountTree', () => {
  test('parses a node and recurses into children', () => {
    const node = parseAccountTree({
      id: UUID,
      code: '1000',
      name: 'Assets',
      type: 'ASSET',
      children: [{ id: CHILD, name: 'Cash' }],
    });
    expect(node.code).toBe('1000');
    expect(node.type).toBe(AccountType.ASSET);
    expect(node.children).toHaveLength(1);
    expect(node.children[0].id).toBe(CHILD);
  });

  test('throws when id is missing', () => {
    expect(() => parseAccountTree({ code: '1000' })).toThrow();
  });
});
