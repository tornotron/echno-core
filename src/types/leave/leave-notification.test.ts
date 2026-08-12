import { describe, expect, test } from 'bun:test';
import { parseLeaveNotification } from './leave-notification';
import { LeaveNotificationType } from './leave-enums';

describe('parseLeaveNotification', () => {
  test('parses a minimal valid payload with defaults', () => {
    const notification = parseLeaveNotification({ id: 1, employeeId: 2 });
    expect(notification.employeeId).toBe(2);
    expect(notification.type).toBe(LeaveNotificationType.LEAVE_REMINDER);
    expect(notification.isRead).toBe(false);
  });

  test('throws when employeeId is missing', () => {
    expect(() => parseLeaveNotification({ id: 1 })).toThrow();
  });
});
