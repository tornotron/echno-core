import { describe, expect, test } from 'bun:test';
import { parseShiftTiming } from './shift-timing';

const validShift = {
  id: 1,
  shiftName: 'Day Shift',
  startTime: '09:00',
  endTime: '18:00',
  lunchBreakStart: '13:00',
  lunchBreakEnd: '14:00',
  gracePeriodMinutes: 10,
  minimumWorkHours: 8,
  halfDayWorkHours: 4,
  overtimeThreshold: 9,
};

// The boundary validates the full template shape: a complete payload parses,
// but a missing required field fails fast instead of yielding undefined.
describe('parseShiftTiming', () => {
  test('parses a complete valid payload', () => {
    const shift = parseShiftTiming(validShift);
    expect(shift.id).toBe(1);
    expect(shift.shiftName).toBe('Day Shift');
    expect(shift.startTime).toBe('09:00');
  });

  test('rejects a payload missing a required field', () => {
    const { shiftName, ...withoutName } = validShift;
    void shiftName;
    expect(() => parseShiftTiming(withoutName)).toThrow();
  });
});
