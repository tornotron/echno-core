/**
 * @module status-transition
 *
 * One entry in a record's status trail, and its parser. The backend keeps a
 * single trail shared by every document that has a lifecycle — projects,
 * purchase orders and now site transfers — so this shape is deliberately not
 * scoped to any one of them.
 *
 * Entries are append-only: never edited, never deleted.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { nullableString, opaque, optionalNumericId } from '../../lib/validation/backend-schema';

/**
 * How a status came to be held.
 *
 * The distinction is the point of the trail, and a screen that renders all
 * four identically throws it away: {@link StatusTransitionSource.system} says
 * a change nobody decided, and {@link StatusTransitionSource.baseline} says an
 * observation rather than a change at all. Neither should read like somebody's
 * act.
 */
export enum StatusTransitionSource {
  /** The record was created holding this status. */
  creation = 'CREATION',

  /** Somebody changed the status on an existing record. */
  update = 'UPDATE',

  /**
   * The status the record was observed to hold when the trail began, before
   * which nothing was recorded. Carries no actor, ever.
   */
  baseline = 'BASELINE',

  /**
   * A change the system made on its own, with nobody to name — a migration
   * correcting a status to match movements that had already been posted, for
   * instance. A real change, unlike {@link StatusTransitionSource.baseline},
   * but not a person's.
   */
  system = 'SYSTEM',

  /**
   * A source this client does not recognise, which the backend added after
   * this version shipped.
   *
   * Not a wire value: nothing sends `UNKNOWN`. It is where the parser puts a
   * source it cannot name, and it exists so that fallback can be **fail-closed**
   * on attribution. Folding an unrecognised source into
   * {@link StatusTransitionSource.update} would make {@link isPersonsChange}
   * answer `true` for it, and any new system-generated source would then be
   * drawn as somebody's act beside whatever name happened to be on the entry.
   * Attributing a change to nobody is recoverable; attributing it to a
   * colleague who did not make it is not.
   */
  unknown = 'UNKNOWN',
}

/** Human-readable label for each {@link StatusTransitionSource}. */
export const statusTransitionSourceLabels: Record<StatusTransitionSource, string> = {
  [StatusTransitionSource.creation]: 'Created',
  [StatusTransitionSource.update]: 'Changed',
  [StatusTransitionSource.baseline]: 'Recorded at the start of the trail',
  [StatusTransitionSource.system]: 'Corrected by the system',
  [StatusTransitionSource.unknown]: 'Recorded',
};

/**
 * Whether an entry was somebody's act rather than the system's.
 *
 * `false` for {@link StatusTransitionSource.system},
 * {@link StatusTransitionSource.baseline} and
 * {@link StatusTransitionSource.unknown}, which is what lets a screen show
 * those apart from a person's change instead of attributing a migration to
 * whoever happens to be named nearby.
 *
 * Written as an allowlist of the two sources a person makes, so a source added
 * to the enum later is not a person's act until somebody says it is.
 *
 * @param entry - The trail entry.
 * @returns `true` when a person made the change.
 */
export function isPersonsChange(entry: StatusTransition): boolean {
  return (
    entry.source === StatusTransitionSource.creation ||
    entry.source === StatusTransitionSource.update
  );
}

/** Shape of the backend status-transition payload at the parse boundary. */
const StatusTransitionResponseSchema = z.object({
  id: opaque,
  fromStatus: nullableString,
  toStatus: nullableString,
  source: nullableString,
  occurredAt: nullableString,
  changedBy: optionalNumericId,
  changedByName: nullableString,
  note: nullableString,
});

/** One entry in a record's status trail. */
export interface StatusTransition {
  /** Database id of the entry. */
  id: number;

  /**
   * Status held before this entry, or `null` where there was none: the record
   * was created in {@link StatusTransition.toStatus}, or this is the baseline
   * entry the trail opened with.
   */
  fromStatus: string | null;

  /** Status held after this entry. */
  toStatus: string;

  /** How the status came about. */
  source: StatusTransitionSource;

  /**
   * When the status came to be held, as an ISO 8601 date-time. For a
   * {@link StatusTransitionSource.baseline} entry this is when the trail
   * began, not when the record was created.
   */
  occurredAt: string;

  /**
   * Id of the person who made the change, or `null` where there was no user
   * context — which is every `BASELINE` entry and every `SYSTEM` one.
   */
  changedBy: number | null;

  /**
   * That person's name as it read at the time, kept beside the id so a rename
   * or a removal does not rewrite history. Empty where there is no person.
   */
  changedByName: string;

  /** Anything recorded about the change beyond the two statuses. */
  note?: string;
}

/**
 * Parses a raw status-transition payload into a typed
 * {@link StatusTransition}.
 *
 * An unrecognised `source` falls back to {@link StatusTransitionSource.unknown}
 * rather than throwing, so a source the backend adds later still renders — but
 * as one nobody is named for, never as a person's act.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link StatusTransition}.
 * @throws {TypeError} When `raw.id` is missing or non-positive.
 */
export function parseStatusTransition(json: unknown): StatusTransition {
  const raw = StatusTransitionResponseSchema.parse(json);
  const source = raw.source as StatusTransitionSource;
  return {
    id: parsePositiveInt(raw.id, 'parseStatusTransition.id'),
    fromStatus: raw.fromStatus ?? null,
    toStatus: raw.toStatus ?? '',
    source: Object.values(StatusTransitionSource).includes(source)
      ? source
      : StatusTransitionSource.unknown,
    occurredAt: raw.occurredAt ?? '',
    changedBy: raw.changedBy ?? null,
    changedByName: raw.changedByName ?? '',
    note: raw.note ?? undefined,
  };
}
