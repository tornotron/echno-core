import { describe, expect, test } from 'bun:test';
import { parseLeaveApproval } from './leave-approval';
import { ApprovalAction } from './leave-enums';

describe('parseLeaveApproval', () => {
  test('parses a minimal valid payload', () => {
    const approval = parseLeaveApproval({
      id: 1,
      leaveRequestId: 2,
      approverId: 3,
    });
    expect(approval.id).toBe(1);
    expect(approval.leaveRequestId).toBe(2);
    expect(approval.action).toBe(ApprovalAction.PENDING);
  });

  test('coerces a numeric-string id', () => {
    const approval = parseLeaveApproval({
      id: '7',
      leaveRequestId: 2,
      approverId: 3,
    });
    expect(approval.id).toBe(7);
  });

  test('throws when a required id is missing', () => {
    expect(() =>
      parseLeaveApproval({ leaveRequestId: 2, approverId: 3 })
    ).toThrow();
  });

  test('throws on a non-positive id', () => {
    expect(() =>
      parseLeaveApproval({ id: -1, leaveRequestId: 2, approverId: 3 })
    ).toThrow();
  });
});
