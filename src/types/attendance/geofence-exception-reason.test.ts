/**
 * The reason an employee gives for marking attendance from outside the site
 * boundary has to reach the server.
 *
 * Both check-in serializers build an explicit allowlist rather than spreading
 * the request object, so a field added to the interface and forgotten in the
 * serializer type-checks, passes review, and is silently dropped on the wire.
 * The whole DTO also travels URL-encoded in a `?data=` query parameter rather
 * than a JSON body, which is why the repository's request-contract checker
 * lists both of these call sites as unreadable: nothing automated compares
 * these field names against the backend. That check is these tests.
 *
 * The consequence of dropping it is not a missing field. The server takes an
 * absent reason on an out-of-fence punch as "no reason given" and refuses the
 * punch with a 422, so the employee is blocked from marking attendance while
 * looking at the reason they just typed.
 *
 * Server side is tornotron/echno-backend#646.
 */
import { describe, expect, test } from 'bun:test';

import { attendanceCheckInToJson } from './attendance-check-in';
import { createClockEventToJson } from './clock-event-create';
import { ClockEventType } from './clock-event';

const REASON = 'Working from head office today for the client review';

describe('check-in serializer', () => {
  test('sends the geofence exception reason under the name the backend reads', () => {
    const json = attendanceCheckInToJson({
      employeeId: 42,
      projectId: 12,
      eventTimestamp: new Date(2026, 8, 6, 9, 2),
      geofenceExceptionReason: REASON,
    });

    expect(json.geofenceExceptionReason).toBe(REASON);
  });

  test('omits it when the punch was on site', () => {
    const json = attendanceCheckInToJson({
      employeeId: 42,
      projectId: 12,
      eventTimestamp: new Date(2026, 8, 6, 9, 2),
    });

    expect(json.geofenceExceptionReason).toBeUndefined();
  });
});

describe('clock-event serializer', () => {
  test('sends the geofence exception reason under the name the backend reads', () => {
    const json = createClockEventToJson({
      attendanceId: 7,
      eventType: ClockEventType.eveningClockOut,
      eventTimestamp: new Date(2026, 8, 6, 18, 0),
      geofenceExceptionReason: REASON,
    });

    expect(json.geofenceExceptionReason).toBe(REASON);
  });

  test('omits it when the punch was on site', () => {
    const json = createClockEventToJson({
      attendanceId: 7,
      eventType: ClockEventType.eveningClockOut,
      eventTimestamp: new Date(2026, 8, 6, 18, 0),
    });

    expect(json.geofenceExceptionReason).toBeUndefined();
  });
});
