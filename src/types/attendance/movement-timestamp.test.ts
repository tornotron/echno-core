import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createMovementToJson } from './movement-create';
import { parseMovementRecord } from './movement';
import { MovementType } from './movement-type';
import { toLocalDateTimeString } from '../../lib/utils/date-helpers';

// Pinned to a non-UTC zone on purpose, the same as `clock-timestamp.test.ts`. The
// runner defaults to UTC, where a UTC serializer and a local one produce the same
// wall clock and every assertion below would pass against the bug it is written to
// catch. IST is UTC+05:30 and has no DST, so the expected strings are stable.
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

/** A Date fixed at a wall-clock time on the day under test. */
function localAt(hours: number, minutes: number): Date {
  return new Date(2026, 7, 27, hours, minutes, 0, 0);
}

const NAIVE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const base = {
  attendanceId: 5,
  movementType: MovementType.siteTravel,
  fromLocation: 'Kovilambakkam Site Office',
  purpose: 'Vendor negotiation',
};

describe('createMovementToJson', () => {
  test('sends startTime as the local wall clock, not UTC', () => {
    const json = createMovementToJson({ ...base, startTime: localAt(11, 0) });

    expect(json.startTime).toBe('2026-08-27T11:00:00');
    expect(json.startTime as string).toMatch(NAIVE);
  });

  test('sends endTime as the local wall clock when one is given', () => {
    const json = createMovementToJson({
      ...base,
      startTime: localAt(11, 0),
      endTime: localAt(12, 30),
    });

    expect(json.endTime).toBe('2026-08-27T12:30:00');
  });

  test('leaves endTime undefined on an open movement', () => {
    const json = createMovementToJson({ ...base, startTime: localAt(11, 0) });

    expect(json.endTime).toBeUndefined();
  });

  test('keeps a movement started just after midnight on its own date', () => {
    const json = createMovementToJson({ ...base, startTime: localAt(0, 30) });

    expect((json.startTime as string).slice(0, 10)).toBe('2026-08-27');
  });
});

describe('parseMovementRecord', () => {
  const valid = {
    id: 3,
    attendanceId: 5,
    employeeId: 9,
    createdAt: '2026-08-27T09:00:00Z',
    updatedAt: '2026-08-27T09:30:00Z',
  };

  test('reads startTime back as the wall clock it was sent as', () => {
    const sent = localAt(11, 0);
    const movement = parseMovementRecord({
      ...valid,
      startTime: toLocalDateTimeString(sent),
    });

    expect(movement.startTime.getTime()).toBe(sent.getTime());
    expect(movement.startTime.getHours()).toBe(11);
  });

  test('reads endTime as a local wall clock too', () => {
    const sent = localAt(12, 30);
    const movement = parseMovementRecord({
      ...valid,
      startTime: '2026-08-27T11:00:00',
      endTime: toLocalDateTimeString(sent),
    });

    expect(movement.endTime?.getTime()).toBe(sent.getTime());
  });

  test('still reads the server-set timestamps as UTC', () => {
    const movement = parseMovementRecord({
      ...valid,
      startTime: '2026-08-27T11:00:00',
      createdAt: '2026-08-27T09:00:00',
    });

    expect(movement.createdAt.toISOString()).toBe('2026-08-27T09:00:00.000Z');
  });

  test('honours an explicit offset on startTime', () => {
    const movement = parseMovementRecord({
      ...valid,
      startTime: '2026-08-27T11:00:00Z',
    });

    expect(movement.startTime.toISOString()).toBe('2026-08-27T11:00:00.000Z');
  });
});
