/**
 * Two of the four call sites the request-contract check reports as "not an
 * endpoint in the document" were not missing endpoints at all. Both exist and
 * are served today; this package was addressing them at the wrong path, so
 * every call 404'd.
 *
 * - `employeeService.joinOrganization` posted to
 *   `/employee/web/joinOrganization/{userId}/{organizationId}`. That is the
 *   shape `EmployeeController` publishes on the bare `/employee` prefix.
 *   `EmployeeControllerWeb` names both segments:
 *   `/joinOrganization/userId/{userId}/organizationId/{orgId}`. The doc comment
 *   on the method called this "the only employee-create code path the backend
 *   actually supports today", which made it the one worth getting right.
 *
 * - `leaveService.withdrawRequest` posted to `/leave-requests/web/withdraw`,
 *   which no controller publishes at all. The mapping is
 *   `POST /leave-requests/web/employeeId/{employeeId}/withdraw` with
 *   `requestId` as a query parameter, and `employeeId` has to be in the path
 *   because `@PreAuthorize("@orgSecurity.isSelfOrHasAnyOrgRole(#employeeId, …)")`
 *   reads it from there. The `onSuccess` comment in `useWithdrawLeaveRequest`
 *   already quoted the correct mapping, so the right path was written down one
 *   file away from the wrong one for as long as both existed.
 *
 * **Both were checked against the controllers' own `@PostMapping` values rather
 * than by calling them.** A path Spring does not route answers 401 behind
 * Spring Security, exactly as a real path does for an unauthenticated caller,
 * so a status code cannot tell a missing endpoint from a present one.
 *
 * `joinOrganization` also gained a body. It sent `{}`, and
 * `EmployeeJoinOrgDto` marks `status` required. The Java field carries a
 * default of `active`, so an omitted value bound to the same thing and the
 * request would have succeeded, but a client cannot both read the document and
 * omit a field the document says is required. Sending it costs nothing and
 * removes the contradiction.
 *
 * The remaining two findings of that four are genuinely absent and stay on
 * echno-core#57: `POST /employee/web`, whose `@PostMapping` is commented out in
 * `EmployeeControllerWeb`, and `PATCH /issues/comments/web/{id}`, which
 * `IssueCommentControllerWeb` has never had — it publishes only `POST` and
 * `DELETE`. Neither is a path this package can correct; each is a decision
 * about whether the endpoint should exist.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { employeeService } from './employee-service';
import { leaveService } from './leave-service';
import { EmployeeStatus } from '../types/employee/employee-status';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

afterEach(() => {
  // spyOn installs on the shared api object; restore so tests stay independent.
  (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** Enough of an employee to satisfy the parser on the way back out. */
const parseableEmployee: Raw = {
  id: 41,
  organizationId: 3,
  employeeName: 'Priya Raman',
  emailAddress: 'priya@example.com',
  status: 'active',
};

describe('joining an organization names both path segments', () => {
  test('the post goes to the web controller mapping, not the bare one', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(parseableEmployee);

    await employeeService.joinOrganization(12, 3);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toBe(
      '/employee/web/joinOrganization/userId/12/organizationId/3'
    );
  });

  test('the body carries the status the DTO requires', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(parseableEmployee);

    await employeeService.joinOrganization(12, 3);

    expect(post.mock.calls[0]?.[1]).toEqual({ status: EmployeeStatus.active });
  });

  test('a caller may start the record in another status', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(parseableEmployee);

    await employeeService.joinOrganization(12, 3, EmployeeStatus.probation);

    expect(post.mock.calls[0]?.[1]).toEqual({
      status: EmployeeStatus.probation,
    });
  });
});

describe('withdrawing a leave request carries the employee in the path', () => {
  test('the post goes to the mapping the authorization rule reads from', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({});

    await leaveService.withdrawRequest(31, 7);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toBe(
      '/leave-requests/web/employeeId/7/withdraw'
    );
  });

  test('requestId stays a query parameter, which is where the mapping takes it', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({});

    await leaveService.withdrawRequest(31, 7);

    // The third argument is the query object. Sending the request id in the
    // body instead would reach the mapping and then fail to bind.
    expect(post.mock.calls[0]?.[1]).toEqual({});
    expect(post.mock.calls[0]?.[2]).toEqual({ requestId: 31 });
  });
});
