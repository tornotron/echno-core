/**
 * @module types/inspection/review-batch
 *
 * One decision on many observations at once (backend `ReviewBatchRequest`
 * and `ReviewBatchResponse`), served from
 * `POST /inspections/web/observations/review-batch`.
 *
 * Bulk review is for the grid of a model's detections: accept with no
 * outcome, or reject with one reason and one note, for up to 100 ids the
 * reviewer has seen. `MODIFY`, and any outcome other than none, stay in the
 * single-item review where the whole photo is in view. There is no accept
 * by filter: the client sends the ids.
 *
 * Each observation is decided in its own transaction and comes back with its
 * own status, so one refusal never undoes the others. Every row reviewed in
 * the call carries the same `batchId`, as does its event.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import { nullableString, opaque } from '../../lib/validation/backend-schema';
import { ObservationDecision, RejectReason } from './observation';

/** Most ids one bulk review takes. */
export const REVIEW_BATCH_MAX_IDS = 100;

/** A bulk decision: accept with no outcome, or reject. */
export interface ReviewBatchRequest {
  /** `ACCEPT` or `REJECT`; `MODIFY` is refused before the request is sent. */
  decision: ObservationDecision.ACCEPT | ObservationDecision.REJECT;
  /** The observations to decide, 1 to {@link REVIEW_BATCH_MAX_IDS}. */
  observationIds: string[];
  /** Reviewer's note for all of them (max 4000). Required on `REJECT`. */
  note?: string;
  /**
   * `REJECT` only, and sent only then. Each observation with producer
   * regions is refused on its own (status `REFUSED`) when it is missing.
   */
  rejectReason?: RejectReason;
}

/**
 * Serializes a {@link ReviewBatchRequest} into the backend body.
 *
 * The envelope rules are checked first, so a grid gets a plain error before
 * the round trip; the backend answers each of these with a 400 and writes
 * nothing.
 *
 * @param dto - The bulk decision.
 * @returns A plain object matching the backend `ReviewBatchRequest`.
 * @throws {TypeError} On `MODIFY`, on no ids or more than 100, or on a
 *   rejection without a note.
 */
export function reviewBatchToJson(dto: ReviewBatchRequest): Record<string, unknown> {
  // Widened so the MODIFY guard holds for a caller that bypassed the type.
  const decision = dto.decision as ObservationDecision;
  if (decision === ObservationDecision.MODIFY) {
    throw new TypeError('A modification needs the single-item review.');
  }
  if (dto.observationIds.length === 0) {
    throw new TypeError('A bulk review needs at least one observation.');
  }
  if (dto.observationIds.length > REVIEW_BATCH_MAX_IDS) {
    throw new TypeError(
      `A bulk review takes at most ${REVIEW_BATCH_MAX_IDS} observations.`
    );
  }
  if (decision === ObservationDecision.REJECT && !dto.note?.trim()) {
    throw new TypeError('A rejection needs a note saying why.');
  }
  const json: Record<string, unknown> = {
    decision,
    observationIds: dto.observationIds,
  };
  if (dto.note !== undefined) json.note = dto.note;
  if (decision === ObservationDecision.REJECT && dto.rejectReason !== undefined)
    json.rejectReason = dto.rejectReason;
  return json;
}

/**
 * What happened to one observation in a bulk review. The backend writes the
 * Java constant names here (the nested `Status` enum has no `@JsonValue`),
 * so these are upper case, unlike the inspection enums.
 */
export type ReviewBatchItemStatus =
  | 'REVIEWED'
  | 'ALREADY_REVIEWED'
  | 'NOT_FOUND'
  | 'REFUSED';

/** Every {@link ReviewBatchItemStatus}, in the backend's declaration order. */
export const REVIEW_BATCH_ITEM_STATUSES: readonly ReviewBatchItemStatus[] = [
  'REVIEWED',
  'ALREADY_REVIEWED',
  'NOT_FOUND',
  'REFUSED',
];

/** Human-readable label for each {@link ReviewBatchItemStatus}. */
export const reviewBatchItemStatusLabels: Record<ReviewBatchItemStatus, string> = {
  REVIEWED: 'Reviewed',
  ALREADY_REVIEWED: 'Already reviewed',
  NOT_FOUND: 'Not found',
  REFUSED: 'Refused',
};

/**
 * Narrows an untyped backend string to {@link ReviewBatchItemStatus},
 * defaulting to `REFUSED`: a result the client cannot read is treated as not
 * done, so the tile stays selected for another try rather than looking
 * decided.
 */
export function parseReviewBatchItemStatus(raw: unknown): ReviewBatchItemStatus {
  return typeof raw === 'string' &&
    (REVIEW_BATCH_ITEM_STATUSES as readonly string[]).includes(raw)
    ? (raw as ReviewBatchItemStatus)
    : 'REFUSED';
}

/** One observation's outcome in a bulk review. */
export interface ReviewBatchItemResult {
  /** UUID of the observation. */
  observationId: string;
  /** What happened to it. */
  status: ReviewBatchItemStatus;
  /** Why, when it was refused. */
  message?: string;
}

/** The per-observation results of a bulk review, in the order posted. */
export interface ReviewBatchResult {
  /** Stamped on every reviewed row and its event. */
  batchId: string;
  /** One entry per id posted. */
  results: ReviewBatchItemResult[];
}

const ReviewBatchItemSchema = z.object({
  observationId: z.string().nullish(),
  status: opaque,
  message: nullableString,
});

const ReviewBatchResultSchema = z.object({
  batchId: z.string().nullish(),
  results: z.array(ReviewBatchItemSchema).nullish(),
});

/**
 * Parses the backend `ReviewBatchResponse` into a typed
 * {@link ReviewBatchResult}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns The parsed result.
 * @throws {TypeError} If `batchId` or a result's `observationId` is missing.
 */
export function parseReviewBatchResult(json: unknown): ReviewBatchResult {
  const raw = ReviewBatchResultSchema.parse(json);
  return {
    batchId: parseUuid(raw.batchId, 'parseReviewBatchResult.batchId'),
    results: (raw.results ?? []).map((item) => ({
      observationId: parseUuid(
        item.observationId,
        'parseReviewBatchResult.results.observationId'
      ),
      status: parseReviewBatchItemStatus(item.status),
      message: item.message ?? undefined,
    })),
  };
}

/**
 * Whether one result left the observation decided: reviewed in this call,
 * or already decided by someone else. Either way there is nothing more to
 * do on it from the grid.
 *
 * @param result - One entry of {@link ReviewBatchResult.results}.
 * @returns `true` for `REVIEWED` and `ALREADY_REVIEWED`.
 */
export function isReviewBatchItemSettled(result: ReviewBatchItemResult): boolean {
  return result.status === 'REVIEWED' || result.status === 'ALREADY_REVIEWED';
}
