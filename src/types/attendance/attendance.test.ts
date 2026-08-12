import { describe, expect, test } from 'bun:test';
import { parseAttendance } from './attendance';

const shiftTiming = {
  id: 1,
  shiftName: 'General',
  startTime: '09:00',
  endTime: '18:00',
  lunchBreakStart: '13:00',
  lunchBreakEnd: '14:00',
  gracePeriodMinutes: 10,
  minimumWorkHours: 8,
  halfDayWorkHours: 4,
  overtimeThreshold: 9,
};

const valid = {
  id: 5,
  date: '2026-02-25',
  shiftTiming,
  createdAt: '2026-02-25T09:00:00Z',
  updatedAt: '2026-02-25T18:00:00Z',
};

describe('parseAttendance boundary validation', () => {
  test('parses a valid record and its embedded shift timing', () => {
    const attendance = parseAttendance(valid);
    expect(attendance.id).toBe(5);
    expect(attendance.shiftTiming.id).toBe(1);
    expect(attendance.date.toISOString()).toBe('2026-02-25T00:00:00.000Z');
  });

  test('rejects a record missing shiftTiming', () => {
    const { shiftTiming: _omitted, ...rest } = valid;
    void _omitted;
    expect(() => parseAttendance(rest)).toThrow();
  });

  test('rejects a non-positive id', () => {
    expect(() => parseAttendance({ ...valid, id: 0 })).toThrow();
  });
});
