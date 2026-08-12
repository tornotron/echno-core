import { describe, expect, test } from 'bun:test';
import {
  parseGroupedLeaveCalendarEntry,
  parseLeaveCalendarEntry,
} from './leave-calendar';
import { HalfDayType } from './leave-enums';

describe('parseLeaveCalendarEntry', () => {
  test('parses a minimal valid payload with defaults', () => {
    const entry = parseLeaveCalendarEntry({
      id: 1,
      leaveRequestId: 2,
      employeeId: 3,
    });
    expect(entry.employeeId).toBe(3);
    expect(entry.halfDayType).toBe(HalfDayType.FULL_DAY);
  });

  test('throws when employeeId is missing', () => {
    expect(() =>
      parseLeaveCalendarEntry({ id: 1, leaveRequestId: 2 })
    ).toThrow();
  });
});

describe('parseGroupedLeaveCalendarEntry', () => {
  test('parses nested entries', () => {
    const grouped = parseGroupedLeaveCalendarEntry({
      date: '2026-01-01',
      entries: [{ id: 1, leaveRequestId: 2, employeeId: 3 }],
    });
    expect(grouped.entries).toHaveLength(1);
    expect(grouped.count).toBe(0);
  });
});
