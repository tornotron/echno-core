import { describe, expect, test } from 'bun:test';
import { parseLeavePolicy } from './leave-policy';
import {
  AccrualMethod,
  LeaveApproverRole,
  WeekendHolidayTreatment,
} from './leave-enums';

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

describe('parseLeavePolicy configuration rules (backend #838)', () => {
  test('defaults the three rules to the backend defaults when absent', () => {
    const policy = parseLeavePolicy({ id: 1, organizationId: 2 });
    expect(policy.accrualMethod).toBe(AccrualMethod.MONTHLY);
    expect(policy.weekendHolidayTreatment).toBe(
      WeekendHolidayTreatment.CHARGE_ALL_DAYS
    );
    expect(policy.approverRole).toBe(LeaveApproverRole.REPORTING_MANAGER);
    expect(policy.supportingDocumentNote).toBeUndefined();
  });

  test('reads the rules and falls back on a name it does not know', () => {
    const policy = parseLeavePolicy({
      id: 1,
      organizationId: 2,
      accrualMethod: 'IN_FULL_ON_QUALIFYING',
      weekendHolidayTreatment: 'SANDWICH',
      approverRole: 'SOMETHING_NEW',
      supportingDocumentNote: 'Birth certificate',
    });
    expect(policy.accrualMethod).toBe(AccrualMethod.IN_FULL_ON_QUALIFYING);
    expect(policy.weekendHolidayTreatment).toBe(
      WeekendHolidayTreatment.SANDWICH
    );
    expect(policy.approverRole).toBe(LeaveApproverRole.REPORTING_MANAGER);
    expect(policy.supportingDocumentNote).toBe('Birth certificate');
  });
});
