import { describe, expect, test } from 'bun:test';
import { parseAttendanceRegularization } from './regularization';

describe('parseAttendanceRegularization', () => {
  test('maps requestedById and approvedById when present', () => {
    const reg = parseAttendanceRegularization({
      id: 1,
      attendanceId: 2,
      reason: 'forgot clock-out',
      requestedBy: 'Alice',
      requestedById: 10,
      approvedBy: 'Bob',
      approvedById: 20,
      requestedAt: '2026-08-20T10:00:00Z',
      status: 'approved',
    });
    expect(reg.requestedById).toBe(10);
    expect(reg.approvedById).toBe(20);
  });

  test('leaves the ids undefined when absent', () => {
    const reg = parseAttendanceRegularization({
      id: 1,
      attendanceId: 2,
      reason: 'forgot clock-out',
      requestedBy: 'Alice',
      requestedAt: '2026-08-20T10:00:00Z',
      status: 'pending',
    });
    expect(reg.requestedById).toBeUndefined();
    expect(reg.approvedById).toBeUndefined();
  });
});
