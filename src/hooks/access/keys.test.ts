import { describe, expect, test } from 'bun:test';
import { accessKeys } from './keys';

describe('accessKeys', () => {
  test("the current user's access sits under the root", () => {
    expect(accessKeys.currentUser()).toEqual(['access', 'current-user']);
    expect(accessKeys.currentUser().slice(0, 1)).toEqual([...accessKeys.all]);
  });
});

describe('Roles & Permissions keys', () => {
  test('the two lists and the catalog sit under the root, apart from the current user', () => {
    expect(accessKeys.catalog()).toEqual(['access', 'catalog']);
    expect(accessKeys.roles()).toEqual(['access', 'roles']);
    expect(accessKeys.users()).toEqual(['access', 'users']);
  });

  test('one role or person nests under its list, so the list prefix refreshes it', () => {
    expect(accessKeys.role('r-1')).toEqual(['access', 'roles', 'r-1']);
    expect(accessKeys.role('r-1').slice(0, 2)).toEqual([...accessKeys.roles()]);
    expect(accessKeys.user(7)).toEqual(['access', 'users', 7]);
    expect(accessKeys.user(7).slice(0, 2)).toEqual([...accessKeys.users()]);
  });
});
