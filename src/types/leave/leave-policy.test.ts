import { describe, expect, test } from 'bun:test';
import { parseLeavePolicy } from './leave-policy';

describe('parseLeavePolicy', () => {
  test('parses a minimal valid payload with defaults', () => {
    const policy = parseLeavePolicy({ id: 1, organizationId: 2 });
    expect(policy.organizationId).toBe(2);
    expect(policy.minDaysPerRequest).toBe(0.5);
    expect(policy.applicableGenders).toBe('ALL');
    expect(policy.isActive).toBe(true);
  });

  test('defaults multiLevelApprovalEnabled to true when absent', () => {
    const policy = parseLeavePolicy({ id: 1, organizationId: 2 });
    expect(policy.multiLevelApprovalEnabled).toBe(true);
  });

  test('honours an explicit multiLevelApprovalEnabled of false', () => {
    const policy = parseLeavePolicy({
      id: 1,
      organizationId: 2,
      multiLevelApprovalEnabled: false,
    });
    expect(policy.multiLevelApprovalEnabled).toBe(false);
  });

  test('throws when organizationId is missing', () => {
    expect(() => parseLeavePolicy({ id: 1 })).toThrow();
  });
});
