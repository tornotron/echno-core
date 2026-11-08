import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

/**
 * Pinned by reading the source, the way the bim hook tests do. The writes
 * answer with no body, so each hook must refresh what it changed: a person's
 * roles are read from both tabs, and a role's grants can change what the
 * caller holds through the baseline.
 */
const source = readFileSync(new URL('./use-access-admin-mutations.ts', import.meta.url), 'utf8');

const body = (hook: string) => {
  const start = source.indexOf(`export const ${hook} = `);
  expect(start, hook).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('\n};\n', start));
};

const hooks = [
  'useCreateAccessRole',
  'useUpdateAccessRole',
  'useSetAccessRoleGrants',
  'useSetAccessRoleGrantableRoles',
  'useDeleteAccessRole',
  'useSetAccessUserRoles',
];

describe('access admin mutations', () => {
  test('every write refreshes the roles', () => {
    for (const hook of hooks) expect(body(hook), hook).toInclude('accessKeys.roles()');
  });

  test("a role's grants refresh the caller's own access", () => {
    expect(body('useSetAccessRoleGrants')).toInclude('accessKeys.currentUser()');
  });

  test("a person's roles refresh both tabs", () => {
    expect(body('useSetAccessUserRoles')).toInclude('accessKeys.users(), accessKeys.roles()');
  });

  test('a deleted role drops its own query and refreshes the people', () => {
    const del = body('useDeleteAccessRole');
    expect(del).toInclude('removeQueries({ queryKey: accessKeys.role(roleId)');
    expect(del).toInclude('accessKeys.users()');
  });

  test('no write keeps a response it does not get', () => {
    expect(source).not.toInclude('setQueryData');
  });
});
