import { describe, expect, test } from 'bun:test';
import { parseLeaveRequest } from './leave-request';

// Same timezone fix as the attendance parsers: naive backend timestamps must be
// read as UTC, not the client's local time.
describe('parseLeaveRequest date handling', () => {
  test('parses a naive startDate as UTC', () => {
    const request = parseLeaveRequest({
      id: 1,
      employeeId: 1,
      leavePolicyId: 1,
      startDate: '2026-02-25T10:30:00',
    });

    expect(request.startDate.toISOString()).toBe('2026-02-25T10:30:00.000Z');
  });

  test('parses a naive createdAt as UTC and leaves an absent one undefined', () => {
    const withCreated = parseLeaveRequest({
      id: 1,
      employeeId: 1,
      leavePolicyId: 1,
      createdAt: '2026-02-25T10:30:00',
    });
    expect(withCreated.createdAt?.toISOString()).toBe('2026-02-25T10:30:00.000Z');

    const withoutCreated = parseLeaveRequest({ id: 1, employeeId: 1, leavePolicyId: 1 });
    expect(withoutCreated.createdAt).toBeUndefined();
  });
});
