/**
 * @module types/attendance/clock-event
 *
 * Clock-event types for attendance tracking: the {@link ClockEventType} enum,
 * the {@link GeoLocation} and {@link ClockEvent} interfaces, geo-fence
 * distance helpers, and the parser / serializer.
 */

import { z } from "zod";
import { parsePositiveInt } from "../../lib/utils/parse-id";
import {
  parseLocalDateTime,
  parseUTCDate,
  toLocalDateTimeString,
} from "../../lib/utils/date-helpers";
import {
  backendDate,
  nullableBoolean,
  nullableNumber,
  nullableString,
  opaque,
  optionalNumericId,
} from "../../lib/validation/backend-schema";

/**
 * Shape of the backend clock-event payload at the parse boundary. Only `id` is
 * required; every other field may be absent on a partial punch, so the parser
 * validates the types it does receive and leaves the rest to pass through.
 */
const ClockEventResponseSchema = z.object({
  id: opaque,
  eventType: nullableString,
  timestamp: backendDate,
  location: opaque,
  photoUrl: nullableString,
  projectId: optionalNumericId,
  projectName: nullableString,
  deviceInfo: opaque,
  isWithinGeofence: nullableBoolean,
  distanceFromProject: nullableNumber,
  geofenceRadiusMeters: nullableNumber,
  geofenceExceptionReason: nullableString,
  recordedById: optionalNumericId,
  remarks: nullableString,
  verifiedBy: nullableString,
  verifiedAt: backendDate,
  isRegularized: nullableBoolean,
  regularizationReason: nullableString,
});


/** The four punch points that make up an attendance day. */
export enum ClockEventType {
  /** Start-of-day punch. */
  morningClockIn = 'morningClockIn',
  /** Punch leaving for the lunch break. */
  lunchBreakStart = 'lunchBreakStart',
  /** Punch returning from the lunch break. */
  lunchBreakEnd = 'lunchBreakEnd',
  /** End-of-day punch. */
  eveningClockOut = 'eveningClockOut',
}

/** A geographic point captured at clock time. */
export interface GeoLocation {
  /** Latitude in decimal degrees. */
  latitude: number;
  /** Longitude in decimal degrees. */
  longitude: number;
  /** GPS horizontal accuracy in meters, if reported. */
  accuracy?: number;
  /** Altitude in meters, if reported. */
  altitude?: number;
  /** Vertical accuracy in meters, if reported. */
  altitudeAccuracy?: number;
}

/** A single clock punch with its location, selfie, and verification state. */
export interface ClockEvent {
  /** Unique surrogate identifier. */
  id: number;
  /** Which of the day's punch points this event represents. */
  eventType: ClockEventType;
  /** When the punch was recorded. */
  timestamp: Date;
  /** Where the punch was recorded. */
  location: GeoLocation;
  /** URL of the selfie captured at punch time. */
  photoUrl: string;
  /** Project the punch was logged against. */
  projectId: number;
  /** Denormalized project display name. */
  projectName: string;
  /** Device metadata captured at punch time, if available. */
  deviceInfo?: {
    /** Originating platform — `iOS`, `Android`, or `Web`. */
    platform: string;
    /** Device identifier. */
    deviceId: string;
    /** Originating IP address, if captured. */
    ipAddress?: string;
  };
  /**
   * Whether {@link location} fell inside the project geo-fence, or `undefined`
   * when the server reached no verdict.
   *
   * Optional on purpose. A caller has to be able to tell "the punch was outside
   * the fence" from "nobody worked out where the punch was", and those are not
   * the same statement to put in front of an employee. Absent must therefore
   * stay absent rather than being read as a definite `false`.
   *
   * The server evaluates this as of tornotron/echno-backend#646. Absent stays
   * common and is not a violation: the project may carry no coordinates, the
   * punch may carry no position, the event may have come from a regularization
   * rather than a live punch, or the punch may have been entered by a
   * supervisor for somebody else, in which case the captured position is the
   * supervisor's and says nothing about the employee. Every clock event written
   * before #646 is also `undefined`, because none of them were ever measured.
   */
  isWithinGeofence?: boolean;
  /**
   * Distance in meters from the project location at punch time, or `undefined`
   * when the geo-fence was not evaluated.
   *
   * Optional for the same reason as {@link isWithinGeofence}, and with more at
   * stake: a fabricated `0` does not read as missing, it reads as the employee
   * having stood exactly on the site marker. Never substitute a `0` here.
   */
  distanceFromProject?: number;
  /**
   * The geo-fence radius in meters that the verdict was reached against, as it
   * stood at punch time, or `undefined` when the geo-fence was not evaluated.
   *
   * Carried so a punch still explains itself after the radius or the project's
   * coordinates are edited. Render the verdict against this, not against the
   * project's current settings, which may no longer be the ones that applied.
   */
  geofenceRadiusMeters?: number;
  /**
   * Why the employee marked their own attendance from outside the site
   * boundary, or `undefined` when they did not.
   *
   * Being outside the fence does not block the punch. The employee supplies a
   * reason, it is stored here, and the day's attendance record is held for
   * their reporting manager to approve.
   */
  geofenceExceptionReason?: string;
  /**
   * The employee who submitted the punch, which is not always the employee it
   * belongs to: a supervisor can record attendance for their team.
   *
   * This is what makes an absent {@link isWithinGeofence} readable. When it
   * differs from the attendance record's employee, the geo-fence was
   * deliberately not evaluated because the captured position is the
   * submitter's.
   */
  recordedById?: number;
  /** Optional remarks entered by the employee. */
  remarks?: string;
  /** Name of the admin who verified the punch, if verified. */
  verifiedBy?: string;
  /** When the punch was verified. */
  verifiedAt?: Date;
  /** Whether the punch was added/adjusted via a regularization. */
  isRegularized?: boolean;
  /** Reason recorded when the punch was regularized. */
  regularizationReason?: string;
}

/**
 * Returns the human-readable label for a clock-event type.
 *
 * @param eventType - The event type to format.
 * @returns The display label (e.g. `'Morning Clock-In'`).
 */
export function getClockEventLabel(eventType: ClockEventType): string {
  const labels: Record<ClockEventType, string> = {
    [ClockEventType.morningClockIn]: 'Morning Clock-In',
    [ClockEventType.lunchBreakStart]: 'Lunch Break Start',
    [ClockEventType.lunchBreakEnd]: 'Lunch Break End',
    [ClockEventType.eveningClockOut]: 'Evening Clock-Out',
  };
  return labels[eventType];
}

/**
 * Returns the icon name for a clock-event type.
 *
 * @param eventType - The event type to map.
 * @returns An icon identifier (e.g. `'LogIn'`).
 */
export function getClockEventIcon(eventType: ClockEventType): string {
  const icons: Record<ClockEventType, string> = {
    [ClockEventType.morningClockIn]: 'LogIn',
    [ClockEventType.lunchBreakStart]: 'Coffee',
    [ClockEventType.lunchBreakEnd]: 'PlayCircle',
    [ClockEventType.eveningClockOut]: 'LogOut',
  };
  return icons[eventType];
}

/**
 * Computes the great-circle distance between two points using the Haversine
 * formula.
 *
 * @param loc1 - First coordinate.
 * @param loc2 - Second coordinate.
 * @returns The distance between the points, in meters.
 */
export function calculateDistance(
  loc1: GeoLocation,
  loc2: GeoLocation
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (loc1.latitude * Math.PI) / 180;
  const φ2 = (loc2.latitude * Math.PI) / 180;
  const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Returns whether an employee's location falls within the project geo-fence.
 *
 * @param employeeLocation - The employee's coordinate at punch time.
 * @param projectLocation - The project's reference coordinate.
 * @param radiusMeters - Geo-fence radius in meters. Defaults to `100`.
 * @returns `true` if the distance is within `radiusMeters`.
 */
export function isWithinGeofence(
  employeeLocation: GeoLocation,
  projectLocation: GeoLocation,
  radiusMeters: number = 100
): boolean {
  const distance = calculateDistance(employeeLocation, projectLocation);
  return distance <= radiusMeters;
}

/**
 * Parses a raw clock-event payload into a typed {@link ClockEvent}.
 *
 * Hydrates `timestamp` and `verifiedAt` into `Date` objects; other fields are
 * passed through. Expects the SDK's camelCase shape (backend field-name
 * mapping is done in `attendance-service.ts`).
 *
 * The two date fields use different conventions on purpose. `timestamp` is the
 * punch time the client supplied, whose contract is a local wall clock, so a
 * naive value is read as local. `verifiedAt` is set by the server, which runs
 * in UTC, so a naive value there is read as UTC.
 *
 * The geo-fence fields are narrowed from `null` to `undefined` rather than
 * passed through. The server sends an explicit `null` for a punch it did not
 * evaluate, and the spread would carry that null into a field the interface
 * declares as `boolean | undefined`, so the declared type and the runtime value
 * would disagree. They are never defaulted: an absent verdict has to stay
 * absent, because a manufactured `false` reads as a violation and a
 * manufactured `0` reads as the employee standing on the site marker.
 *
 * @param data - The untyped JSON object received from the backend.
 * @returns A `ClockEvent` with date fields hydrated.
 */
export function parseClockEvent(data: unknown): ClockEvent {
  const raw = ClockEventResponseSchema.parse(data);
  return {
    ...raw,
    id: parsePositiveInt(raw.id, 'parseClockEvent.id'),
    timestamp:
      parseLocalDateTime(raw.timestamp) ?? new Date(raw.timestamp as string),
    verifiedAt: parseUTCDate(raw.verifiedAt) ?? undefined,
    isWithinGeofence: raw.isWithinGeofence ?? undefined,
    distanceFromProject: raw.distanceFromProject ?? undefined,
    geofenceRadiusMeters: raw.geofenceRadiusMeters ?? undefined,
    geofenceExceptionReason: raw.geofenceExceptionReason ?? undefined,
    recordedById: raw.recordedById ?? undefined,
  } as ClockEvent;
}

/**
 * Serializes a {@link ClockEvent} for transmission to the backend.
 *
 * Encodes both dates as naive local date-time strings. `timestamp` is the punch
 * contract; `verifiedAt` is server-set and response-only, and is carried here
 * only so the object round-trips. Other fields are passed through unchanged.
 *
 * @param event - The clock event to serialize.
 * @returns A plain object with the date fields encoded for the wire.
 */
export function clockEventToJson(event: ClockEvent): Record<string, unknown> {
  return {
    ...event,
    timestamp: toLocalDateTimeString(event.timestamp),
    verifiedAt: event.verifiedAt && toLocalDateTimeString(event.verifiedAt),
  };
}
