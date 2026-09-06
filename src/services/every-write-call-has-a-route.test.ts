/**
 * The last three findings on echno-core#57, pinned where they were settled.
 *
 * Two of them were calls addressing paths no controller publishes, which is the
 * sharpest failure the request-contract check reports: the request is not
 * dropped silently, it 404s. Both were checked against the controllers' own
 * mapping annotations rather than by calling them, because a path Spring does
 * not route answers 401 behind Spring Security exactly as a real path does for
 * an unauthenticated caller, so a status code cannot tell the two apart.
 *
 * **`employeeService.create`** posted to `/employee/web`, where
 * `EmployeeControllerWeb` has its plain `@PostMapping` commented out. The hook
 * behind it threw rather than make the call, so nothing was ever sent, and the
 * only employee create this package can reach is `joinOrganization`. A direct
 * create does exist on the non-web prefix, but it names the organization by
 * `organizationName` instead of deriving the tenant from the token, so it is
 * not a route the console should be pointed at without a redesign. Whether a
 * web create should exist is echno-backend#675.
 *
 * **`issueCommentService.update`** patched `/issues/comments/web/{id}`, which
 * was never written: neither issue-comment controller publishes a PATCH or a
 * PUT, and `IssueCommentService` has no update method. Whether a comment
 * should be editable is echno-backend#676.
 *
 * The third is different in kind and is the one worth a behavioural test.
 * `createLeaveRequestToJson` put `employeeId` in the body, where
 * `LeaveRequestCreationDto` has no field for it. The endpoint does want the
 * value, on the query string: `LeaveRequestControllerWeb.createRequest` reads
 * it from a `@RequestParam`, and its `@PreAuthorize` reads the same parameter.
 * So this is not a key to delete, it is a key that was being sent twice and
 * read once. Dropping it from the body while it stays on the query is the
 * whole change, and the risk in that edit is losing the query argument along
 * with the body key, which is what the last test here exists to catch.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { employeeService } from './employee-service';
import { issueCommentService } from './issue-comment-service';
import { leaveService } from './leave-service';
import { createLeaveRequestToJson } from '../types/leave/leave-request-create';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

afterEach(() => {
  (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('calls to routes the backend does not publish', () => {
  test('the employee service offers no direct create', () => {
    expect(employeeService).not.toHaveProperty('create');
    // The replacement is not "nothing": an employee is still created, through
    // the one path the controller does publish.
    expect(typeof employeeService.joinOrganization).toBe('function');
  });

  test('the issue-comment service offers no update', () => {
    expect(issueCommentService).not.toHaveProperty('update');
    // Posting and deleting are what the controller serves, and both stay.
    expect(typeof issueCommentService.create).toBe('function');
    expect(typeof issueCommentService.delete).toBe('function');
  });
});

describe('where a leave request carries its employee', () => {
  const request = {
    employeeId: 41,
    leavePolicyId: 3,
    startDate: '2026-09-14',
    endDate: '2026-09-16',
    reason: "Attending sister's wedding in Coimbatore",
  };

  test('the body does not name the employee', () => {
    const payload = createLeaveRequestToJson(request);

    expect(payload).not.toHaveProperty('employeeId');
    // Pinned alongside, because taking one key out of an object literal is the
    // edit that takes the line below it too.
    expect(payload).toMatchObject({
      leavePolicyId: 3,
      startDate: '2026-09-14',
      endDate: '2026-09-16',
      reason: "Attending sister's wedding in Coimbatore",
      submitImmediately: false,
    });
  });

  test('the query string does, which is where the endpoint reads it', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({
      id: 900,
      employeeId: 41,
      leavePolicyId: 3,
      startDate: '2026-09-14',
      endDate: '2026-09-16',
      status: 'draft',
    } as Raw);

    await leaveService.createRequest(request);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toBe('/leave-requests/web');
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty('employeeId');
    expect(post.mock.calls[0]?.[2]).toEqual({ employeeId: 41 });
  });
});
