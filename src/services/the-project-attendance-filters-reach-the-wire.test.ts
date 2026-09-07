/**
 * The two attendance filters survive the trip from the service call to the
 * request, rather than stopping at the params type.
 *
 * The serializer is unit-tested next to itself; this pins the other half, that
 * `getByProject` hands the serialized query to the client instead of building
 * its own object out of the fields it happens to know about. A query assembled
 * key by key in the service compiles cleanly and silently ignores anything
 * added to `AttendanceListParams` afterwards, which is how this endpoint came
 * to be missing both parameters in the first place.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { attendanceService } from './attendance-service';

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('the project attendance listing', () => {
  test('sends both filters on the request', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
    } as never);

    await attendanceService.getByProject({
      projectId: 4,
      date: '2026-09-07',
      requiresApproval: true,
      approvalStatus: 'approved',
    });

    expect(get).toHaveBeenCalledWith('/attendance/web/project/4', {
      date: '2026-09-07',
      requiresApproval: true,
      approvalStatus: 'APPROVED',
    });
  });
});
