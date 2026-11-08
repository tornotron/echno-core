/**
 * Bulk review (core #166, backend WP4). Shapes transcribed from
 * `ReviewBatchRequest` and `ReviewBatchResponse` on echno-backend
 * `development`.
 */
import { describe, expect, test } from 'bun:test';
import { ObservationDecision, RejectReason } from './observation';
import {
  REVIEW_BATCH_ITEM_STATUSES,
  isReviewBatchItemSettled,
  parseReviewBatchResult,
  reviewBatchToJson,
} from './review-batch';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const BATCH = '99999999-9999-9999-9999-999999999999';

describe('reviewBatchToJson', () => {
  test('an accept sends the decision and the ids', () => {
    expect(
      reviewBatchToJson({ decision: ObservationDecision.ACCEPT, observationIds: [A, B] })
    ).toEqual({ decision: 'accept', observationIds: [A, B] });
  });

  test('a rejection sends one note and one reason for all of them', () => {
    expect(
      reviewBatchToJson({
        decision: ObservationDecision.REJECT,
        observationIds: [A],
        note: 'Shadows',
        rejectReason: RejectReason.FALSE_POSITIVE,
      })
    ).toEqual({
      decision: 'reject',
      observationIds: [A],
      note: 'Shadows',
      rejectReason: 'false-positive',
    });
  });

  test('a reason on an accept is not sent', () => {
    expect(
      reviewBatchToJson({
        decision: ObservationDecision.ACCEPT,
        observationIds: [A],
        rejectReason: RejectReason.DUPLICATE,
      })
    ).toEqual({ decision: 'accept', observationIds: [A] });
  });

  test('refuses the envelopes the backend refuses', () => {
    expect(() =>
      reviewBatchToJson({
        decision: ObservationDecision.MODIFY as ObservationDecision.ACCEPT,
        observationIds: [A],
      })
    ).toThrow(TypeError);
    expect(() =>
      reviewBatchToJson({ decision: ObservationDecision.ACCEPT, observationIds: [] })
    ).toThrow(TypeError);
    expect(() =>
      reviewBatchToJson({
        decision: ObservationDecision.ACCEPT,
        observationIds: Array.from({ length: 101 }, () => A),
      })
    ).toThrow(TypeError);
    expect(() =>
      reviewBatchToJson({ decision: ObservationDecision.REJECT, observationIds: [A], note: '  ' })
    ).toThrow(TypeError);
  });
});

describe('parseReviewBatchResult', () => {
  test('reads one result per id with its status and message', () => {
    const result = parseReviewBatchResult({
      batchId: BATCH,
      results: [
        { observationId: A, status: 'REVIEWED', message: null },
        { observationId: B, status: 'REFUSED', message: 'A rejectReason is required' },
      ],
    });
    expect(result).toEqual({
      batchId: BATCH,
      results: [
        { observationId: A, status: 'REVIEWED', message: undefined },
        { observationId: B, status: 'REFUSED', message: 'A rejectReason is required' },
      ],
    });
    expect(result.results.map(isReviewBatchItemSettled)).toEqual([true, false]);
  });

  test('an unreadable status is treated as refused, so it stays selected', () => {
    const result = parseReviewBatchResult({
      batchId: BATCH,
      results: [{ observationId: A, status: 'reviewed' }],
    });
    expect(result.results[0]?.status).toBe('REFUSED');
  });

  test('already reviewed counts as settled, not found does not', () => {
    const result = parseReviewBatchResult({
      batchId: BATCH,
      results: [
        { observationId: A, status: 'ALREADY_REVIEWED' },
        { observationId: B, status: 'NOT_FOUND' },
      ],
    });
    expect(result.results.map(isReviewBatchItemSettled)).toEqual([true, false]);
  });

  test('refuses a result with no batch id', () => {
    expect(() => parseReviewBatchResult({ results: [] })).toThrow(TypeError);
  });

  test('the statuses are the Java constant names, pinned', () => {
    // ReviewBatchResponse.Status has no @JsonValue: the wire value is the name.
    expect(REVIEW_BATCH_ITEM_STATUSES).toEqual([
      'REVIEWED',
      'ALREADY_REVIEWED',
      'NOT_FOUND',
      'REFUSED',
    ]);
  });
});
