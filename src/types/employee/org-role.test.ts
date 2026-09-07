import { describe, expect, test } from 'bun:test';
import { parseEmployee } from './employee';
import {
  ADMIN_ROLES,
  MANAGER_ROLES,
  NORMAL_ROLES,
  getOrgRoleLabel,
  isAdmin,
  isManager,
  OrgRole,
  orgRoleFromString,
} from './org-role';

// The backend's org roles reach this enum by hand, with no codegen between them,
// and `parseEmployee` drops any role string it does not recognise rather than
// failing. A role added on the backend and forgotten here therefore produces no
// error anywhere: `employee.orgRoles` comes back one role short, every permission
// check reads false, and nothing says so.
//
// Every assertion below is written against the wire string rather than against
// `OrgRole.STORE_KEEPER`, and that is the point. Written the obvious way, three of
// these four tests passed with the enum member deleted, because a missing member
// is `undefined` on both sides of the comparison: `orgRoleFromString` returns
// `undefined`, `OrgRole.STORE_KEEPER` is `undefined`, `toBe` is satisfied, and
// `toEqual([undefined])` is satisfied by an empty array. Naming the string is what
// makes them fail when the role goes missing, which is the only reason they exist.
describe('the store-keeper role survives the trip from the backend', () => {
  test('parses out of an employee payload instead of being dropped', () => {
    const employee = parseEmployee({
      id: 1,
      employeeName: 'Ravi',
      organizationId: 5,
      orgRoles: ['STORE_KEEPER'],
    });

    expect(employee.orgRoles).toStrictEqual(['STORE_KEEPER' as OrgRole]);
  });

  test('is a role this enum knows', () => {
    expect(orgRoleFromString('STORE_KEEPER')).toBe('STORE_KEEPER' as OrgRole);
  });

  test('has a label of its own rather than falling back to the raw string', () => {
    expect(getOrgRoleLabel('STORE_KEEPER' as OrgRole)).toBe('Storekeeper');
  });

  // The backend keeps store-keeper out of OrgRole.getManagerRoles(), which decides
  // who may be named the manager on a project invite code and who appears in the
  // manager listings. Running a store is not managing people, and the cohorts here
  // have to agree or the two ends disagree about the same user.
  test('is an ordinary role rather than an admin or manager one', () => {
    const storeKeeper = 'STORE_KEEPER' as OrgRole;

    expect(NORMAL_ROLES.has(storeKeeper)).toBe(true);
    expect(ADMIN_ROLES.has(storeKeeper)).toBe(false);
    expect(MANAGER_ROLES.has(storeKeeper)).toBe(false);
    expect(isAdmin([storeKeeper])).toBe(false);
    expect(isManager([storeKeeper])).toBe(false);
  });
});
