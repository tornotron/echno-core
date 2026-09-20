import { describe, expect, test } from 'bun:test';
import { ApiError } from '../../lib/api/api-client';
import {
  CheckItemStatus,
  checklistProgress,
  isCheckItemAnswered,
  parseCheckItemStatus,
  readChecklistIncomplete,
} from './inspection';

describe('CheckItemStatus.NOT_DONE', () => {
  test('round-trips through its wire value', () => {
    expect(parseCheckItemStatus('not-done')).toBe(CheckItemStatus.NOT_DONE);
  });

  test('only pending is unanswered', () => {
    expect(isCheckItemAnswered(CheckItemStatus.PENDING)).toBe(false);
    for (const status of Object.values(CheckItemStatus)) {
      if (status !== CheckItemStatus.PENDING) {
        expect(isCheckItemAnswered(status)).toBe(true);
      }
    }
  });
});

describe('checklistProgress', () => {
  test('counts not-done as answered and reports it on its own', () => {
    const progress = checklistProgress([
      { status: CheckItemStatus.PASSED },
      { status: CheckItemStatus.FAILED },
      { status: CheckItemStatus.NOT_APPLICABLE },
      { status: CheckItemStatus.NOT_DONE },
      { status: CheckItemStatus.PENDING },
      { status: CheckItemStatus.PENDING },
    ]);

    expect(progress).toEqual({ total: 6, answered: 4, pending: 2, notDone: 1 });
  });

  test('an empty checklist is complete', () => {
    expect(checklistProgress([])).toEqual({
      total: 0,
      answered: 0,
      pending: 0,
      notDone: 0,
    });
  });
});

describe('readChecklistIncomplete', () => {
  const body = {
    type: 'about:blank',
    title: 'Checklist Incomplete',
    status: 422,
    detail: 'Inspection INSP-2026-0007 cannot be submitted: 2 check points are still unanswered.',
    message: 'Inspection INSP-2026-0007 cannot be submitted: 2 check points are still unanswered.',
    inspectionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    inspectionNumber: 'INSP-2026-0007',
    unansweredCount: 2,
    unansweredItems: [
      { index: 1, id: '12345678-1234-1234-1234-123456789abc', category: 'Reinforcement', checkPoint: 'Cover blocks' },
      { index: 4, id: null, category: 'Formwork', checkPoint: 'Shutter alignment' },
    ],
  };

  test('reads the refusal out of the ApiError the client throws', () => {
    const error = new ApiError(body.message, 422, undefined, undefined, body.title, body);

    const refusal = readChecklistIncomplete(error);

    expect(refusal).toEqual({
      message: body.message,
      inspectionId: body.inspectionId,
      inspectionNumber: body.inspectionNumber,
      unansweredItems: [
        { index: 1, id: '12345678-1234-1234-1234-123456789abc', category: 'Reinforcement', checkPoint: 'Cover blocks' },
        { index: 4, id: undefined, category: 'Formwork', checkPoint: 'Shutter alignment' },
      ],
    });
  });

  test('falls back to detail when the legacy message key is absent', () => {
    const { message: _message, ...withoutMessage } = body;
    const error = new ApiError('fallback', 422, undefined, undefined, body.title, withoutMessage);

    expect(readChecklistIncomplete(error)?.message).toBe(body.detail);
  });

  test('is undefined for any other failure', () => {
    expect(readChecklistIncomplete(new ApiError('nope', 422))).toBeUndefined();
    expect(
      readChecklistIncomplete(new ApiError('nope', 400, undefined, undefined, 'Invalid Request', body))
    ).toBeUndefined();
    expect(
      readChecklistIncomplete(
        new ApiError('nope', 422, undefined, undefined, 'Unprocessable Request', {
          ...body,
          unansweredItems: [],
        })
      )
    ).toBeUndefined();
    expect(readChecklistIncomplete(new Error('plain'))).toBeUndefined();
    expect(readChecklistIncomplete(undefined)).toBeUndefined();
  });
});
