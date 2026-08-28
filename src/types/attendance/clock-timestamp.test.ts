import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

// Pinned to a non-UTC zone on purpose. The runner defaults to UTC, where a UTC
// serializer and a local one produce the same wall clock and every assertion
// below would pass against the bug it is written to catch. IST is UTC+05:30 and
// has no DST, so the expected strings are stable. Restored afterwards so the
// zone does not leak into the rest of the suite.
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

import {
  parseLocalDateTime,
  toLocalDateTimeString,
} from '../../lib/utils/date-helpers';
import { attendanceCheckInToJson } from './attendance-check-in';
import { ClockEventType, parseClockEvent } from './clock-event';
import { createClockEventToJson } from './clock-event-create';
import { createRegularizationToJson } from './regularization-create';

// The backend receives these timestamps into `java.time.LocalDateTime`, which has
// no offset. Serializing with `toISOString()` therefore shifted every clock time by
// the client's offset, and near midnight moved the derived attendance date onto the
// previous day. The contract is a local wall-clock string with no suffix.
//
// These assertions must hold on any machine, so they compare against the helper
// rather than against a hard-coded zone.

/** A Date fixed at 09:00 local time on the day under test. */
function localAt(hours: number, minutes: number): Date {
  return new Date(2026, 7, 27, hours, minutes, 0, 0);
}

const NAIVE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

describe('toLocalDateTimeString', () => {
  test('emits the wall-clock components with no timezone suffix', () => {
    expect(toLocalDateTimeString(localAt(9, 0))).toBe('2026-08-27T09:00:00');
  });

  test('keeps a just-after-midnight punch on its own date', () => {
    expect(toLocalDateTimeString(localAt(0, 30))).toBe('2026-08-27T00:30:00');
  });

  test('pads single-digit components', () => {
    expect(toLocalDateTimeString(new Date(2026, 0, 5, 7, 8, 9))).toBe(
      '2026-01-05T07:08:09'
    );
  });
});

describe('parseLocalDateTime', () => {
  test('round-trips a wall-clock string back to the same wall clock', () => {
    const original = localAt(9, 0);
    const parsed = parseLocalDateTime(toLocalDateTimeString(original));

    expect(parsed?.getTime()).toBe(original.getTime());
  });

  test('honours an explicit offset rather than reinterpreting it', () => {
    expect(parseLocalDateTime('2026-08-27T09:00:00Z')?.toISOString()).toBe(
      '2026-08-27T09:00:00.000Z'
    );
    expect(
      parseLocalDateTime('2026-08-27T14:30:00+05:30')?.toISOString()
    ).toBe('2026-08-27T09:00:00.000Z');
  });

  test('returns null for nullish and unparseable input', () => {
    expect(parseLocalDateTime(null)).toBeNull();
    expect(parseLocalDateTime(undefined)).toBeNull();
    expect(parseLocalDateTime('not a date')).toBeNull();
  });
});

describe('check-in serializer', () => {
  test('sends the local wall clock, not UTC', () => {
    const json = attendanceCheckInToJson({
      employeeId: 42,
      projectId: 12,
      eventTimestamp: localAt(9, 0),
    });

    expect(json.eventTimestamp).toBe('2026-08-27T09:00:00');
    expect(json.eventTimestamp as string).toMatch(NAIVE);
  });

  test('keeps a 00:30 punch on its own date', () => {
    const json = attendanceCheckInToJson({
      employeeId: 42,
      projectId: 12,
      eventTimestamp: localAt(0, 30),
    });

    expect((json.eventTimestamp as string).slice(0, 10)).toBe('2026-08-27');
  });
});

describe('clock-event serializer', () => {
  test('sends the local wall clock, not UTC', () => {
    const json = createClockEventToJson({
      attendanceId: 7,
      eventType: ClockEventType.eveningClockOut,
      eventTimestamp: localAt(18, 0),
    });

    expect(json.eventTimestamp).toBe('2026-08-27T18:00:00');
    expect(json.eventTimestamp as string).toMatch(NAIVE);
  });
});

describe('regularization serializer', () => {
  test('sends each corrected punch as a local wall clock', () => {
    const json = createRegularizationToJson({
      attendanceId: 7,
      reason: 'Forgot to clock out',
      missingEvents: [ClockEventType.eveningClockOut],
      correctedEvents: [
        {
          eventType: ClockEventType.eveningClockOut,
          eventTimestamp: localAt(18, 0),
          projectId: 12,
        },
      ],
    });

    const corrected = json.correctedEvents as Array<Record<string, unknown>>;
    expect(corrected[0].eventTimestamp).toBe('2026-08-27T18:00:00');
  });
});

describe('clock-event parser', () => {
  test('reads a naive punch back as the same wall clock it was sent as', () => {
    const sent = localAt(9, 0);
    const event = parseClockEvent({
      id: 1,
      timestamp: toLocalDateTimeString(sent),
    });

    expect(event.timestamp.getTime()).toBe(sent.getTime());
    expect(event.timestamp.getHours()).toBe(9);
  });

  test('still honours an offset-bearing punch', () => {
    const event = parseClockEvent({
      id: 1,
      timestamp: '2026-08-27T09:00:00Z',
    });

    expect(event.timestamp.toISOString()).toBe('2026-08-27T09:00:00.000Z');
  });
});
