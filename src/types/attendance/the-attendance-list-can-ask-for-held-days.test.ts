/**
 * The project attendance listing can ask for the days that were held for a
 * decision, and separately for where a day sits in the approval workflow.
 *
 * echno-backend#712 added both parameters and this package could send neither,
 * so the filter existed on the server and nowhere else. Three things are
 * pinned here, and a green `tsc` catches none of them:
 *
 * - A `false` dropped by a truthiness test. `requiresApproval: false` asks for
 *   the ordinary days; a `if (params.requiresApproval)` guard compiles, omits
 *   the parameter, and the server then answers with every day of the month,
 *   which reads as a filter that quietly does nothing.
 * - The two collapsed into one. They are orthogonal on purpose: a day that was
 *   held and has since been approved is only reachable by sending both, and a
 *   serializer that emitted one of them at a time would still typecheck.
 * - An enum sent in the client's own casing. `approvalStatus` is
 *   SCREAMING_SNAKE_CASE on the wire like every other one, and a lower-case
 *   value is not rejected loudly; Spring answers 400 or, worse for a filter,
 *   the request is simply not the one the caller wrote.
 */
import { describe, expect, test } from 'bun:test';

import { attendanceListParamsToQuery } from './attendance-list-params';
import { AttendanceStatus } from './attendance-status';

const base = { projectId: 4, date: '2026-09-07' } as const;

describe('asking for the days held for a decision', () => {
  test('puts requiresApproval on the query', () => {
    expect(
      attendanceListParamsToQuery({ ...base, requiresApproval: true })
    ).toMatchObject({ requiresApproval: true });
  });

  test('sends false rather than dropping it', () => {
    // The ordinary days are a real question, and the answer to "not held" is
    // not the same as the answer to "no filter at all".
    const q = attendanceListParamsToQuery({
      ...base,
      requiresApproval: false,
    });

    expect(Object.keys(q)).toContain('requiresApproval');
    expect(q.requiresApproval).toBe(false);
  });
});

describe('asking where a day sits in the approval workflow', () => {
  test('maps the status to the wire enum', () => {
    expect(
      attendanceListParamsToQuery({ ...base, approvalStatus: 'approved' })
    ).toMatchObject({ approvalStatus: 'APPROVED' });

    expect(
      attendanceListParamsToQuery({ ...base, approvalStatus: 'rejected' })
    ).toMatchObject({ approvalStatus: 'REJECTED' });

    expect(
      attendanceListParamsToQuery({ ...base, approvalStatus: 'pending' })
    ).toMatchObject({ approvalStatus: 'PENDING' });
  });

  test('stays independent of requiresApproval', () => {
    // "Held, and already approved" is the question the two-parameter shape
    // exists to keep askable. One four-valued dropdown cannot express it.
    const q = attendanceListParamsToQuery({
      ...base,
      requiresApproval: true,
      approvalStatus: 'approved',
    });

    expect(q.requiresApproval).toBe(true);
    expect(q.approvalStatus).toBe('APPROVED');
  });
});

describe('a caller that sets neither', () => {
  test('sends the request it always did', () => {
    // Regression guard on the existing callers: both parameters are no-ops on
    // the server when absent, and absent is what unset has to mean here.
    const q = attendanceListParamsToQuery({
      ...base,
      status: AttendanceStatus.halfDay,
      search: 'ravi',
      page: 2,
      size: 50,
    });

    expect(q).toEqual({
      date: '2026-09-07',
      status: 'HALF_DAY',
      search: 'ravi',
      page: 2,
      size: 50,
    });
  });
});
