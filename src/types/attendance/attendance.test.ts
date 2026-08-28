import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { parseAttendance } from './attendance';

// `date` comes from the backend's `attendanceDate`, which is a `LocalDate`: a
// bare calendar day with no time and no zone. It is now read as local midnight
// on that day rather than as a UTC instant, so the assertion below is about the
// calendar date and not about an instant. Pinned to a non-UTC zone because in
// UTC the two readings are identical and the test cannot tell them apart, which
// is how it passed on CI while asserting the wrong thing.
// Resolved rather than read straight from the environment: TZ is unset on CI,
// and restoring an unset TZ by deleting the key freezes the zone for the rest of
// the process in Bun, so later files can no longer pin their own. Assigning a
// concrete zone back is the only restore that works.
const originalTimeZone =
  process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

beforeAll(() => {
  process.env.TZ = 'Asia/Kolkata';
});

afterAll(() => {
  process.env.TZ = originalTimeZone;
});

/** The local calendar date, which is what a `LocalDate` field actually carries. */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

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
    expect(localDay(attendance.date)).toBe('2026-02-25');
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
