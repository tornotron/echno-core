/**
 * The attendance approval queue is fetched for whoever is signed in, and the
 * badge is asked of the server rather than counted off the list.
 *
 * echno-backend#692. A day marked from outside a project's geofence has been
 * routed to a named approver since echno-backend#681, and the decision worked
 * from the first day; finding the record did not. The two listings are a
 * project on one required date and one employee over a range, so an approver
 * with people on several sites had to guess a site and a day, and a day held
 * last week was invisible to anyone not already looking for it.
 *
 * Two things are pinned, and a green `tsc` catches neither. A query object
 * assembled key by key, or an `approverId` reintroduced with a default,
 * compiles cleanly while still putting an id on the wire, which is the shape
 * echno-backend#683 took off the leave queue: an administrator read any
 * colleague's queue by asking for it, while the line managers an approval
 * chain is actually built from could read none of their own. And a count
 * derived from `getPendingApprovals().length` also compiles, and is right
 * only while the queue is shorter than the server's cap.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { attendanceService } from './attendance-service';

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('the attendance approval queue', () => {
  test('is fetched without naming an approver', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([] as never);

    await attendanceService.getPendingApprovals();

    expect(get).toHaveBeenCalledWith('/attendance/web/pending-approvals');
    expect(get.mock.calls[0]?.[1]).toBeUndefined();
  });

  test('parses the records it comes back with', async () => {
    spyOn(api, 'get').mockResolvedValue([
      {
        id: 91,
        employeeId: 7,
        employeeName: 'Ravi Kumar',
        attendanceDate: '2026-09-03',
        projectId: 4,
        projectName: 'Tower A',
        status: 'PRESENT',
        approvalStatus: 'PENDING',
        requiresGeofenceApproval: true,
        geofenceApproverId: 55,
      },
    ] as never);

    const queue = await attendanceService.getPendingApprovals();

    expect(queue).toHaveLength(1);
    // The three fields the client's approval gate reads off the record. A queue
    // that arrived without them would render rows with no buttons on them.
    expect(queue[0]?.approvalStatus).toBe('pending');
    expect(queue[0]?.requiresGeofenceApproval).toBe(true);
    expect(queue[0]?.geofenceApproverId).toBe(55);
  });
});

describe('the badge beside the queue', () => {
  test('is counted by the server, without naming an approver', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({ count: 4 } as never);

    await expect(attendanceService.getPendingApprovalsCount()).resolves.toBe(4);

    expect(get).toHaveBeenCalledWith(
      '/attendance/web/pending-approvals/count'
    );
    expect(get.mock.calls[0]?.[1]).toBeUndefined();
  });

  test('reads zero when the server omits the field', async () => {
    spyOn(api, 'get').mockResolvedValue({} as never);

    await expect(attendanceService.getPendingApprovalsCount()).resolves.toBe(0);
  });

  test('is its own request, not the length of the list', async () => {
    // The endpoints are separate because the listing is capped: past the cap
    // its length stops being the count, and a badge read off it would quietly
    // understate a queue exactly when it is worth reading.
    const get = spyOn(api, 'get').mockResolvedValue({ count: 600 } as never);

    await expect(attendanceService.getPendingApprovalsCount()).resolves.toBe(
      600
    );

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalledWith('/attendance/web/pending-approvals');
  });
});
