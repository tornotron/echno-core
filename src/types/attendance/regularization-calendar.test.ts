import { describe, expect, test } from 'bun:test';
import {
  parseRegularizationCalendarDay,
  regularizationByDateToJson,
} from './regularization-calendar';

describe('parseRegularizationCalendarDay', () => {
  test('reads a missing day as actionable, at local midnight', () => {
    const day = parseRegularizationCalendarDay({
      date: '2026-09-22',
      state: 'MISSING',
      actionable: true,
    });
    expect(day.state).toBe('MISSING');
    expect(day.actionable).toBe(true);
    expect(day.dateKey).toBe('2026-09-22');
    expect(day.date.getFullYear()).toBe(2026);
    expect(day.date.getMonth()).toBe(8);
    expect(day.date.getDate()).toBe(22);
    expect(day.attendanceId).toBeUndefined();
  });

  test('lowercases the request status and keeps the rejection reason', () => {
    const day = parseRegularizationCalendarDay({
      date: '2026-09-03',
      state: 'MISSING',
      actionable: true,
      attendanceId: 30,
      regularizationId: 5,
      regularizationStatus: 'REJECTED',
      rejectionReason: 'No site register entry',
    });
    expect(day.regularizationStatus).toBe('rejected');
    expect(day.rejectionReason).toBe('No site register entry');
    expect(day.attendanceId).toBe(30);
  });

  test('treats an unknown state as needing nothing', () => {
    const day = parseRegularizationCalendarDay({
      date: '2026-09-03',
      state: 'SOMETHING_NEW',
      actionable: true,
    });
    expect(day.state).toBe('COMPLETE');
    expect(day.actionable).toBe(false);
  });

  test('refuses a day without a date', () => {
    expect(() => parseRegularizationCalendarDay({ state: 'MISSING' })).toThrow();
  });
});

describe('regularizationByDateToJson', () => {
  test('sends the local calendar date and drops an empty clock-out', () => {
    const body = regularizationByDateToJson({
      employeeId: 18,
      projectId: 12,
      attendanceDate: new Date(2026, 8, 22, 23, 30),
      reason: 'Phone was dead',
      clockInTime: '09:05',
      clockOutTime: '',
    });
    expect(body).toEqual({
      employeeId: 18,
      projectId: 12,
      attendanceDate: '2026-09-22',
      reason: 'Phone was dead',
      clockInTime: '09:05',
      clockOutTime: undefined,
    });
  });
});
