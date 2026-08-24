import { describe, expect, test } from 'bun:test';
import { updateAccountToJson } from './account-update';

describe('updateAccountToJson', () => {
  test('always emits code, name, and active', () => {
    expect(updateAccountToJson({ code: '1000', name: 'Cash', active: true })).toEqual({
      code: '1000',
      name: 'Cash',
      active: true,
    });
  });

  test('emits description and parentId when present, including null', () => {
    expect(
      updateAccountToJson({
        code: '1000',
        name: 'Cash',
        active: false,
        description: null,
        parentId: null,
      })
    ).toEqual({
      code: '1000',
      name: 'Cash',
      active: false,
      description: null,
      parentId: null,
    });
  });

  test('omits description and parentId when undefined', () => {
    const json = updateAccountToJson({ code: '2000', name: 'AP', active: true });
    expect('description' in json).toBe(false);
    expect('parentId' in json).toBe(false);
  });
});
