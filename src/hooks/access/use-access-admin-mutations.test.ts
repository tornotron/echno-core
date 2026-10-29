import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

/**
 * Pinned by reading the source, the way the bim hook tests do: a write that
 * can change what someone holds must refresh the caller's own access, and a
 * write that changes membership must refresh the list that reads it from the
 * other side.
 */
const source = readFileSync(new URL('./use-access-admin-mutations.ts', import.meta.url), 'utf8');

const body = (hook: string) => {
  const start = source.indexOf(`export const ${hook} = `);
  expect(start, hook).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('\n};\n', start));
};

describe('access admin mutations', () => {
  test("every write that can change someone's holdings refreshes the caller's access", () => {
    for (const hook of [
      'useSetAccessRoleGrants',
      'useSetAccessRoleGrantableRoles',
      'useDeleteAccessRole',
      'useSetAccessGroupMembers',
      'useSetAccessGroupRoles',
      'useSetAccessGroupGrants',
      'useDeleteAccessGroup',
      'useSetAccessUserRoles',
      'useSetAccessUserGrants',
    ]) {
      expect(body(hook), hook).toInclude('accessKeys.currentUser()');
    }
  });

  test('membership written on one side refreshes the list that reads it from the other', () => {
    expect(body('useSetAccessUserRoles')).toInclude('accessKeys.roles()');
    expect(body('useSetAccessGroupMembers')).toInclude('accessKeys.users()');
    expect(body('useDeleteAccessRole')).toInclude('accessKeys.groups(), accessKeys.users()');
    expect(body('useDeleteAccessGroup')).toInclude('accessKeys.users()');
  });
});
