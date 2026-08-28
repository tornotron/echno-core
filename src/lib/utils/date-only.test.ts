import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { toLocalDateAtMidnight } from './date-helpers';
import { formatDateForBackend } from '../../types/user/user';
import { createTaskToJson } from '../../types/task/task-create';
import { createProjectToJson } from '../../types/project/project-create';
import { createEmployeeToJson } from '../../types/employee/employee-create';

// Pinned to a non-UTC zone and restored afterwards. The runner defaults to UTC,
// where the local and UTC calendar dates are always the same and every assertion
// below passes against the bug it is written to catch. IST is UTC+05:30 with no
// DST, so a Date at local midnight falls on the previous UTC day.
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

/** Local midnight on the day under test: the input the old code got wrong. */
const localMidnight = () => new Date(2026, 7, 27, 0, 0, 0, 0);

/** UTC midnight, which a `new Date('2026-08-27')` produces. */
const utcMidnight = () => new Date('2026-08-27T00:00:00.000Z');

describe('toLocalDateAtMidnight', () => {
  test('keeps a local-midnight date on its own day', () => {
    const d = localMidnight();

    // The behaviour being replaced, asserted directly so the difference is visible.
    expect(d.toISOString().slice(0, 10)).toBe('2026-08-26');
    expect(toLocalDateAtMidnight(d)).toBe('2026-08-27T00:00:00');
  });

  test('is unchanged for a UTC-midnight date, which already read correctly', () => {
    expect(toLocalDateAtMidnight(utcMidnight())).toBe('2026-08-27T00:00:00');
  });

  test('zeroes the time component whatever the time of day', () => {
    expect(toLocalDateAtMidnight(new Date(2026, 7, 27, 21, 45, 30))).toBe(
      '2026-08-27T00:00:00'
    );
  });

  test('pads single-digit months and days', () => {
    expect(toLocalDateAtMidnight(new Date(2026, 0, 5, 12, 0, 0))).toBe(
      '2026-01-05T00:00:00'
    );
  });
});

describe('formatDateForBackend', () => {
  test('no longer returns the previous day for a local-midnight date', () => {
    expect(formatDateForBackend(localMidnight())).toBe('2026-08-27T00:00:00');
  });

  test('still agrees with the old behaviour on a UTC-midnight date', () => {
    expect(formatDateForBackend(utcMidnight())).toBe('2026-08-27T00:00:00');
  });
});

describe('date-only request serializers', () => {
  test('task create sends both dates as a local calendar date', () => {
    const json = createTaskToJson({
      title: 'Column casting',
      startDate: localMidnight(),
      endDate: new Date(2026, 8, 30, 0, 0, 0),
    } as Parameters<typeof createTaskToJson>[0]);

    expect(json.startDate).toBe('2026-08-27T00:00:00');
    expect(json.endDate).toBe('2026-09-30T00:00:00');
  });

  test('project create sends both dates as a local calendar date', () => {
    const json = createProjectToJson({
      projectName: 'Marina Towers',
      startDate: localMidnight(),
      endDate: new Date(2027, 2, 31, 0, 0, 0),
    } as Parameters<typeof createProjectToJson>[0]);

    expect(json.startDate).toBe('2026-08-27T00:00:00');
    expect(json.endDate).toBe('2027-03-31T00:00:00');
  });

  test('employee create sends the birth and joining dates as local calendar dates', () => {
    const json = createEmployeeToJson({
      employeeName: 'A Worker',
      dateOfBirth: new Date(1990, 7, 22, 0, 0, 0),
      joiningDate: localMidnight(),
    } as Parameters<typeof createEmployeeToJson>[0]);

    expect(json.dateOfBirth).toBe('1990-08-22T00:00:00');
    expect(json.joiningDate).toBe('2026-08-27T00:00:00');
  });
});
