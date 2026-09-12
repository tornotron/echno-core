import { describe, expect, test } from 'bun:test';
import {
  inspectionEventChanges,
  inspectionEventEmployeeId,
  inspectionEventTypeLabel,
  parseInspectionEvent,
} from './inspection-event';

const ID = '11111111-1111-1111-1111-111111111111';
const SUBJECT = '22222222-2222-2222-2222-222222222222';
const INSPECTION = '33333333-3333-3333-3333-333333333333';

function event(overrides: Record<string, unknown> = {}) {
  return parseInspectionEvent({ id: ID, subjectId: SUBJECT, ...overrides });
}

describe('parseInspectionEvent', () => {
  test('parses a status change with its before and after', () => {
    const row = event({
      projectId: 4,
      inspectionId: INSPECTION,
      subjectType: 'NCR',
      eventType: 'ncr.status.changed',
      actorType: 'USER',
      actorId: '7',
      occurredAt: '2026-09-12T09:00:00',
      before: { status: 'assigned' },
      after: { status: 'corrective-action-complete' },
      note: 'Section re-poured.',
      requestId: 'req-1',
    });
    expect(row.subjectType).toBe('NCR');
    expect(row.inspectionId).toBe(INSPECTION);
    expect(row.eventType).toBe('ncr.status.changed');
    expect(row.actorType).toBe('USER');
    expect(row.before).toEqual({ status: 'assigned' });
    expect(row.after).toEqual({ status: 'corrective-action-complete' });
    expect(row.note).toBe('Section re-poured.');
  });

  test('an unreadable actor is not attributed to a person', () => {
    expect(event({ actorType: 'employee' }).actorType).toBe('SYSTEM');
    expect(event({ subjectType: 'ncr' }).subjectType).toBe('INSPECTION');
  });

  test('an unknown event type is kept as its wire string', () => {
    expect(event({ eventType: 'evidence.attached' }).eventType).toBe(
      'evidence.attached'
    );
  });

  test('refuses a row without a subject', () => {
    expect(() => parseInspectionEvent({ id: ID })).toThrow();
  });
});

describe('inspectionEventEmployeeId', () => {
  test('reads the employee id off a USER event only', () => {
    expect(inspectionEventEmployeeId(event({ actorType: 'USER', actorId: '7' }))).toBe(7);
    expect(
      inspectionEventEmployeeId(event({ actorType: 'AI', actorId: 'claude' }))
    ).toBeUndefined();
    expect(
      inspectionEventEmployeeId(event({ actorType: 'USER', actorId: 'nobody' }))
    ).toBeUndefined();
  });
});

describe('inspectionEventChanges', () => {
  test('lists after fields first, then fields only the before had', () => {
    const changes = inspectionEventChanges(
      event({
        before: { status: 'open', siteEngineerId: 3 },
        after: { status: 'assigned', targetDate: '2026-09-20' },
      })
    );
    expect(changes).toEqual([
      { field: 'status', from: 'open', to: 'assigned' },
      { field: 'targetDate', from: undefined, to: '2026-09-20' },
      { field: 'siteEngineerId', from: 3, to: undefined },
    ]);
  });

  test('is empty when the event carried no state', () => {
    expect(inspectionEventChanges(event())).toEqual([]);
  });
});

describe('inspectionEventTypeLabel', () => {
  test('reads a dot-namespaced constant as words', () => {
    expect(inspectionEventTypeLabel('ncr.verified.without_reinspection')).toBe(
      'Ncr verified without reinspection'
    );
    expect(inspectionEventTypeLabel('')).toBe('Event');
  });
});
