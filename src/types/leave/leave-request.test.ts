import { describe, expect, test } from 'bun:test';
import { parseLeaveRequest } from './leave-request';
import { LeaveStatus } from './leave-enums';

describe('parseLeaveRequest', () => {
  test('parses a minimal valid payload with defaults', () => {
    const request = parseLeaveRequest({
      id: 1,
      employeeId: 2,
      leavePolicyId: 3,
    });
    expect(request.employeeId).toBe(2);
    expect(request.leavePolicyId).toBe(3);
    expect(request.status).toBe(LeaveStatus.DRAFT);
  });

  test('falls back to the nested policy and parses approvals', () => {
    const request = parseLeaveRequest({
      id: 1,
      employeeId: 2,
      leavePolicy: { id: 8, leaveTypeName: 'Annual' },
      approvals: [{ id: 4, leaveRequestId: 1, approverId: 9 }],
    });
    expect(request.leavePolicyId).toBe(8);
    expect(request.leaveTypeName).toBe('Annual');
    expect(request.approvals).toHaveLength(1);
  });

  test('throws when the policy id cannot be resolved', () => {
    expect(() => parseLeaveRequest({ id: 1, employeeId: 2 })).toThrow();
  });
});
