/**
 * An approver's queue, and the question of whether they may act, come from the
 * session rather than from the query string.
 *
 * Sixth entry in the shape closed by echno-backend #589, #599, #607, #631 and
 * #635, filed as #683. `GET /leave-requests/web/pending-approvals`, its count,
 * the `/approver` listing and `GET /leave-approvals/web/can-approve` each took
 * the employee to answer about as a query parameter, under a guard that only
 * asked whether the caller held the system-admin or hr-admin role. The guard
 * checked a role, the query read a number the caller sent, and nothing tied the
 * two together: an administrator read any colleague's queue by asking for it,
 * and the line managers an approval chain is actually built from could not read
 * their own at all.
 *
 * A green `tsc` would not catch a regression here. A query object assembled key
 * by key, or a parameter reintroduced with a default, compiles cleanly while
 * still putting the id on the wire, so the outgoing request is what gets
 * pinned.
 *
 * Every test fails against the previous version of the service, which passed
 * `{ approverId }` or `{ requestId, employeeId }` as the second argument to
 * `api.get`.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { leaveService } from './leave-service';

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('the pending-approval queue', () => {
  test('is fetched without naming an approver', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([] as never);

    await leaveService.getPendingApprovals();

    expect(get).toHaveBeenCalledWith('/leave-requests/web/pending-approvals');
    expect(get.mock.calls[0]?.[1]).toBeUndefined();
  });

  test('is counted without naming an approver', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({ count: 4 } as never);

    await expect(leaveService.getPendingApprovalsCount()).resolves.toBe(4);

    expect(get).toHaveBeenCalledWith(
      '/leave-requests/web/pending-approvals/count'
    );
    expect(get.mock.calls[0]?.[1]).toBeUndefined();
  });
});

describe("an approver's own record of what they have handled", () => {
  test('is fetched without naming an approver', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([] as never);

    await leaveService.getApproverRequests();

    expect(get).toHaveBeenCalledWith('/leave-requests/web/approver');
    expect(get.mock.calls[0]?.[1]).toBeUndefined();
  });
});

describe('the can-approve check', () => {
  test('names the request and nobody else', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      canApprove: true,
    } as never);

    await expect(leaveService.canApprove(12)).resolves.toEqual({
      canApprove: true,
      reason: undefined,
    });

    expect(get).toHaveBeenCalledWith('/leave-approvals/web/can-approve', {
      requestId: 12,
    });
    // The employee to ask about used to ride alongside the request, which let
    // one employee probe another's place in a chain. The server answers about
    // whoever is signed in, so there is nothing left to send.
    expect(get.mock.calls[0]?.[1]).not.toHaveProperty('employeeId');
  });

  test('reads false when the server omits the flag', async () => {
    spyOn(api, 'get').mockResolvedValue({} as never);

    await expect(leaveService.canApprove(12)).resolves.toEqual({
      canApprove: false,
      reason: undefined,
    });
  });
});
