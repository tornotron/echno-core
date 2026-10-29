import { describe, expect, test } from 'bun:test';
import { accessKeys } from './keys';

describe('accessKeys', () => {
  test("the current user's access sits under the root", () => {
    expect(accessKeys.currentUser()).toEqual(['access', 'current-user']);
    expect(accessKeys.currentUser().slice(0, 1)).toEqual([...accessKeys.all]);
  });
});
