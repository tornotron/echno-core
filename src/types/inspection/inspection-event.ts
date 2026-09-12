/**
 * @module types/inspection/inspection-event
 *
 * One entry in the inspection module's append-only event log (backend
 * `InspectionEventDto`), served paged from `/inspections/web/{id}/events`,
 * `/ncrs/web/{id}/events` and the project-wide `/inspections/web/events`.
 *
 * Every state change a service makes to an inspection, one of its check items,
 * a defect, an NCR, an observation or a reinspection writes one of these in
 * the same transaction as the change. The row names the business event
 * (`ncr.verified`, not "field updated"), who did it, and the fields that
 * changed as a `before` and an `after` keyed by the DTO field names this
 * package already knows, so a timeline can render
 * "status: assigned to corrective-action-complete" without a mapping table.
 *
 * Nothing here writes. There is no create request and no serializer: events
 * are recorded server-side and read back.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableString,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

/**
 * The kind of row an event is about. Sent in upper case as the Java enum
 * name; the backend declares no `@JsonValue` for it.
 */
export const INSPECTION_EVENT_SUBJECT_TYPES = [
  'INSPECTION',
  'CHECK_ITEM',
  'DEFECT',
  'NCR',
  'OBSERVATION',
  'REINSPECTION',
] as const;

/** The kind of row an event is about. */
export type InspectionEventSubjectType =
  (typeof INSPECTION_EVENT_SUBJECT_TYPES)[number];

/**
 * Who caused an event. `USER` carries an employee id in `actorId`; `DEVICE` a
 * device id; `AI` the model or generator name; `SYSTEM` the job name.
 */
export const INSPECTION_EVENT_ACTOR_TYPES = [
  'USER',
  'DEVICE',
  'AI',
  'SYSTEM',
] as const;

/** Who caused an event. */
export type InspectionEventActorType =
  (typeof INSPECTION_EVENT_ACTOR_TYPES)[number];

/** Human-readable label for each {@link InspectionEventSubjectType}. */
export const inspectionEventSubjectTypeLabels: Record<
  InspectionEventSubjectType,
  string
> = {
  INSPECTION: 'Inspection',
  CHECK_ITEM: 'Check item',
  DEFECT: 'Defect',
  NCR: 'NCR',
  OBSERVATION: 'Observation',
  REINSPECTION: 'Reinspection',
};

/** Human-readable label for each {@link InspectionEventActorType}. */
export const inspectionEventActorTypeLabels: Record<
  InspectionEventActorType,
  string
> = {
  USER: 'User',
  DEVICE: 'Device',
  AI: 'AI',
  SYSTEM: 'System',
};

/**
 * Narrows an untyped backend string to {@link InspectionEventSubjectType},
 * defaulting to `INSPECTION` when the value is absent or unrecognized.
 */
export function parseInspectionEventSubjectType(
  raw: unknown
): InspectionEventSubjectType {
  return typeof raw === 'string' &&
    (INSPECTION_EVENT_SUBJECT_TYPES as readonly string[]).includes(raw)
    ? (raw as InspectionEventSubjectType)
    : 'INSPECTION';
}

/**
 * Narrows an untyped backend string to {@link InspectionEventActorType},
 * defaulting to `SYSTEM` when the value is absent or unrecognized: an event
 * with no readable actor is not attributed to a person.
 */
export function parseInspectionEventActorType(
  raw: unknown
): InspectionEventActorType {
  return typeof raw === 'string' &&
    (INSPECTION_EVENT_ACTOR_TYPES as readonly string[]).includes(raw)
    ? (raw as InspectionEventActorType)
    : 'SYSTEM';
}

/**
 * The fields an event changed, keyed by the DTO field name. Values are
 * whatever the backend serialised for that field; a status is its wire
 * string, a date its ISO string, an id its number or UUID.
 */
export type InspectionEventState = Record<string, unknown>;

const StateSchema = z.record(z.string(), z.unknown()).nullish();

const InspectionEventSchema = z.object({
  id: z.string().nullish(),
  projectId: optionalNumericId,
  inspectionId: nullableString,
  subjectType: z.unknown().nullish(),
  subjectId: z.string().nullish(),
  eventType: nullableString,
  actorType: z.unknown().nullish(),
  actorId: nullableString,
  occurredAt: backendDate,
  before: StateSchema,
  after: StateSchema,
  note: nullableString,
  requestId: nullableString,
});

/** One entry in the inspection event log. */
export interface InspectionEvent {
  /** UUID primary key. */
  id: string;
  /** Project the subject belongs to, when it has one. */
  projectId?: number;
  /**
   * The inspection this event rolls up to, whatever the subject: an event on a
   * check item, a defect, an NCR or a reinspection carries the inspection it
   * hangs off, so one query returns the whole timeline.
   */
  inspectionId?: string;
  /** What kind of row the event is about. */
  subjectType: InspectionEventSubjectType;
  /** The row the event is about. */
  subjectId: string;
  /**
   * The business event, dot-namespaced: `inspection.status.changed`,
   * `ncr.verified`, `reinspection.outcome.recorded`. A string rather than an
   * enum because a new type on the backend is a constant, never a migration,
   * and a client must render one it has not seen.
   */
  eventType: string;
  /** Who caused it. */
  actorType: InspectionEventActorType;
  /**
   * Who, within the actor type: an employee id (as a string) for `USER`, a
   * device id, a model name or a job name.
   */
  actorId?: string;
  /** When it happened (ISO string). */
  occurredAt: string;
  /** The changed fields as they were, when the event changed anything. */
  before?: InspectionEventState;
  /** The changed fields as they became. */
  after?: InspectionEventState;
  /** The remarks that accompanied the step, when any did. */
  note?: string;
  /** The request that produced it, for correlating with server logs. */
  requestId?: string;
}

/**
 * Parses a raw event payload into a typed {@link InspectionEvent}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `InspectionEvent`.
 * @throws {TypeError} If `id` or `subjectId` is missing or not a non-empty
 *   string.
 */
export function parseInspectionEvent(json: unknown): InspectionEvent {
  const raw = InspectionEventSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseInspectionEvent.id'),
    projectId: raw.projectId ?? undefined,
    inspectionId: raw.inspectionId ?? undefined,
    subjectType: parseInspectionEventSubjectType(raw.subjectType),
    subjectId: parseUuid(raw.subjectId, 'parseInspectionEvent.subjectId'),
    eventType: raw.eventType ?? '',
    actorType: parseInspectionEventActorType(raw.actorType),
    actorId: raw.actorId ?? undefined,
    occurredAt: raw.occurredAt ?? '',
    before: raw.before ?? undefined,
    after: raw.after ?? undefined,
    note: raw.note ?? undefined,
    requestId: raw.requestId ?? undefined,
  };
}

/**
 * The employee id behind a `USER` event, or `undefined` for any other actor
 * or an unreadable id. `actorId` is a string on the wire because the same
 * column holds device ids and job names.
 *
 * @param event - The event to read.
 * @returns The employee id, when the actor is a person.
 */
export function inspectionEventEmployeeId(
  event: InspectionEvent
): number | undefined {
  if (event.actorType !== 'USER' || !event.actorId) return undefined;
  const id = Number(event.actorId);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** One field an event changed, with its two values. */
export interface InspectionEventChange {
  /** The DTO field name. */
  field: string;
  /** The value before, or `undefined` when the event set it for the first time. */
  from?: unknown;
  /** The value after, or `undefined` when the event cleared it. */
  to?: unknown;
}

/**
 * Flattens an event's `before` and `after` into one row per changed field, in
 * the order the backend listed them (after first, then any field only the
 * before had). A field present in both with the same value is still listed,
 * since the backend only stores what changed.
 *
 * @param event - The event to read.
 * @returns The changes, empty when the event carried no state.
 */
export function inspectionEventChanges(
  event: InspectionEvent
): InspectionEventChange[] {
  const before = event.before ?? {};
  const after = event.after ?? {};
  const fields = [
    ...Object.keys(after),
    ...Object.keys(before).filter((field) => !(field in after)),
  ];
  return fields.map((field) => ({
    field,
    from: before[field],
    to: after[field],
  }));
}

/**
 * A readable label for an event type: the dot-namespaced constant with its
 * dots and underscores replaced by spaces and the first letter raised, so
 * `ncr.verified.without_reinspection` reads "Ncr verified without
 * reinspection". A client that knows a type may render its own wording; this
 * is the fallback for the ones it does not.
 *
 * @param eventType - The wire constant.
 * @returns A label, or "Event" when the type is empty.
 */
export function inspectionEventTypeLabel(eventType: string): string {
  const words = eventType.replace(/[._]+/g, ' ').trim();
  if (words === '') return 'Event';
  return words.charAt(0).toUpperCase() + words.slice(1);
}
