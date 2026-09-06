/**
 * A clock event the server said nothing about must not come back as a definite
 * statement about where the employee was.
 *
 * The parser used to finish both geo-fence fields with a fallback:
 * `isWithinGeofence: raw.isWithinGeofence ?? false` and
 * `distanceFromProject: raw.distanceFromProject ?? 0`. The schema types both as
 * nullable, so those fallbacks turned an absent field into two assertions:
 * the employee was outside the project geo-fence, and stood exactly on the site
 * marker. Every consumer then rendered the second-hand version of that, because
 * a bare truthiness check cannot tell a real `false` from a manufactured one.
 *
 * This is not hypothetical. The server did not evaluate the geo-fence at all,
 * so `echno-web` showed "Outside Geofence" against punches taken a few metres
 * from the site (tornotron/echno-web#372). The display was removed, which fixed
 * what was on screen but not the coercion underneath.
 *
 * The server now does evaluate it (tornotron/echno-backend#646), which is what
 * these tests were guarding against: real values and unevaluated ones arrive
 * through the same fields, and only the absence of a fallback keeps them apart.
 * Unevaluated stays common and is not a violation, so the cases below now also
 * cover the three fields that came with the evaluation.
 */
import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { api } from "../lib/api/api-client";
import { attendanceService } from "./attendance-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** An attendance day carrying one punch, with the geo-fence fields varied per test. */
const attendanceWith = (clockEvent: Raw): Raw => ({
  id: 41,
  employeeId: 12,
  employeeName: "Priya Nair",
  attendanceDate: "2026-08-31",
  projectId: 3,
  projectName: "Riverside Tower",
  clockEvents: [
    {
      id: 1,
      eventType: "MORNING_CLOCK_IN",
      eventTimestamp: "2026-08-31T09:04:00",
      latitude: 10.028_173_252_364_484,
      longitude: 76.878_795_697_762_95,
      projectId: 3,
      projectName: "Riverside Tower",
      ...clockEvent,
    },
  ],
});

/**
 * `parseAttendance` resolves the punch array into the four named events, so the
 * morning clock-in is where the single event above comes back.
 */
async function firstEvent(clockEvent: Raw) {
  spyOn(api, "get").mockResolvedValue(attendanceWith(clockEvent) as never);
  const attendance = await attendanceService.getById(41);
  const event = attendance.morningClockIn;
  if (!event) throw new Error("the morning clock-in did not parse");
  return event;
}

describe("a clock event the server did not evaluate", () => {
  test("leaves isWithinGeofence undefined rather than calling it false", async () => {
    const event = await firstEvent({});

    expect(event.isWithinGeofence).toBeUndefined();
  });

  test("leaves distanceFromProject undefined rather than calling it zero", async () => {
    const event = await firstEvent({});

    // A fabricated 0 is worse than a fabricated false: it does not read as
    // missing, it reads as the employee standing on the site marker.
    expect(event.distanceFromProject).toBeUndefined();
  });

  test("treats an explicit null the same as an absent field", async () => {
    const event = await firstEvent({
      isWithinGeofence: null,
      distanceFromProject: null,
    });

    expect(event.isWithinGeofence).toBeUndefined();
    expect(event.distanceFromProject).toBeUndefined();
  });
});

describe("a clock event the server did evaluate", () => {
  test("keeps a genuine false, which is distinguishable from absent", async () => {
    const event = await firstEvent({
      isWithinGeofence: false,
      distanceFromProject: 812.5,
    });

    expect(event.isWithinGeofence).toBe(false);
    expect(event.distanceFromProject).toBe(812.5);
  });

  test("keeps a genuine true", async () => {
    const event = await firstEvent({
      isWithinGeofence: true,
      distanceFromProject: 9.66,
    });

    expect(event.isWithinGeofence).toBe(true);
    expect(event.distanceFromProject).toBe(9.66);
  });

  test("keeps a real zero distance, which the old fallback made unreadable", async () => {
    const event = await firstEvent({
      isWithinGeofence: true,
      distanceFromProject: 0,
    });

    // Indistinguishable from "not evaluated" before this change, because both
    // arrived as 0. Now only a measured 0 produces one.
    expect(event.distanceFromProject).toBe(0);
  });
});

describe("the fields that came with the server-side evaluation", () => {
  test("carries the radius the verdict was reached against", async () => {
    // Without this a consumer would have to render the verdict against the
    // project's current radius, which may not be the one that applied.
    const event = await firstEvent({
      isWithinGeofence: false,
      distanceFromProject: 256.4,
      geofenceRadiusMeters: 100,
    });

    expect(event.geofenceRadiusMeters).toBe(100);
  });

  test("carries the reason the employee gave for marking from outside", async () => {
    const event = await firstEvent({
      isWithinGeofence: false,
      distanceFromProject: 256.4,
      geofenceRadiusMeters: 100,
      geofenceExceptionReason: "At head office for the client review",
    });

    expect(event.geofenceExceptionReason).toBe(
      "At head office for the client review"
    );
  });

  test("leaves the radius and the reason undefined when the server sends null", async () => {
    const event = await firstEvent({
      geofenceRadiusMeters: null,
      geofenceExceptionReason: null,
    });

    expect(event.geofenceRadiusMeters).toBeUndefined();
    expect(event.geofenceExceptionReason).toBeUndefined();
  });

  test("carries who submitted the punch, which explains an absent verdict", async () => {
    // A punch a supervisor entered for somebody else is deliberately left
    // unevaluated, because the captured position is the supervisor's. Without
    // recordedById that null is indistinguishable from a project that has no
    // coordinates set.
    const event = await firstEvent({
      isWithinGeofence: null,
      distanceFromProject: null,
      recordedById: 31,
    });

    expect(event.recordedById).toBe(31);
    expect(event.isWithinGeofence).toBeUndefined();
  });
});
