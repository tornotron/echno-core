/**
 * @module types/attendance/clock-event
 *
 * Clock-event types for attendance tracking: the {@link ClockEventType} enum,
 * the {@link GeoLocation} and {@link ClockEvent} interfaces, geo-fence
 * distance helpers, and the parser / serializer.
 */

import { parsePositiveInt } from "../../lib/utils/parse-id";
import { parseUTCDate } from "../../lib/utils/date-helpers";


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
  /** Whether {@link location} fell inside the project geo-fence. */
  isWithinGeofence: boolean;
  /** Distance in meters from the project location at punch time. */
  distanceFromProject: number;
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
 * @param data - The untyped JSON object received from the backend.
 * @returns A `ClockEvent` with date fields hydrated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseClockEvent(data: any): ClockEvent {
  return {
    ...data,
    id: parsePositiveInt(data.id, 'parseClockEvent.id'),
    timestamp: parseUTCDate(data.timestamp) ?? new Date(data.timestamp),
    verifiedAt: parseUTCDate(data.verifiedAt) ?? undefined,
  };
}

/**
 * Serializes a {@link ClockEvent} for transmission to the backend.
 *
 * Converts `timestamp` and `verifiedAt` to ISO 8601 strings; other fields are
 * passed through unchanged.
 *
 * @param event - The clock event to serialize.
 * @returns A plain object with date fields ISO-encoded.
 */
export function clockEventToJson(event: ClockEvent): Record<string, unknown> {
  return {
    ...event,
    timestamp: event.timestamp.toISOString(),
    verifiedAt: event.verifiedAt?.toISOString(),
  };
}
