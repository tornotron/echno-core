import { describe, expect, test } from 'bun:test';
import {
  hasPendingReinspection,
  parseReinspection,
  parseReinspectionOutcome,
  passedReinspections,
  ReinspectionOutcome,
  reinspectionOutcomeToJson,
  scheduleReinspectionToJson,
} from './reinspection';

const ID = '11111111-1111-1111-1111-111111111111';
const NCR = '22222222-2222-2222-2222-222222222222';
const ORIGINAL = '33333333-3333-3333-3333-333333333333';
const CLONE = '44444444-4444-4444-4444-444444444444';

function attempt(overrides: Record<string, unknown> = {}) {
  return parseReinspection({
    id: ID,
    originalInspectionId: ORIGINAL,
    reinspectionInspectionId: CLONE,
    ...overrides,
  });
}

describe('parseReinspection', () => {
  test('parses a full payload with its lowercase outcome', () => {
    const row = attempt({
      projectId: 4,
      ncrId: NCR,
      sequence: 2,
      requestedById: 3,
      requestedAt: '2026-09-12T09:00:00',
      assignedInspectorId: 8,
      targetDate: '2026-09-20',
      outcome: 'passed',
      outcomeById: 5,
      outcomeAt: '2026-09-21T10:30:00',
      remarks: 'Cover re-measured at 42 mm at all three points.',
    });
    expect(row.ncrId).toBe(NCR);
    expect(row.defectId).toBeUndefined();
    expect(row.originalInspectionId).toBe(ORIGINAL);
    expect(row.reinspectionInspectionId).toBe(CLONE);
    expect(row.sequence).toBe(2);
    expect(row.assignedInspectorId).toBe(8);
    expect(row.targetDate).toBe('2026-09-20');
    expect(row.outcome).toBe(ReinspectionOutcome.PASSED);
    expect(row.outcomeById).toBe(5);
    expect(row.remarks).toStartWith('Cover');
  });

  test('a missing outcome reads as pending, never as a pass', () => {
    expect(attempt().outcome).toBe(ReinspectionOutcome.PENDING);
    expect(parseReinspectionOutcome('PASSED')).toBe(ReinspectionOutcome.PENDING);
    expect(parseReinspectionOutcome('failed')).toBe(ReinspectionOutcome.FAILED);
  });

  test('a missing sequence is the first attempt', () => {
    expect(attempt().sequence).toBe(1);
  });

  test('refuses a row without the two inspections it links', () => {
    expect(() =>
      parseReinspection({ id: ID, originalInspectionId: ORIGINAL })
    ).toThrow();
  });
});

describe('serializers', () => {
  test('scheduling with nothing still sends a body', () => {
    expect(scheduleReinspectionToJson()).toEqual({});
    expect(scheduleReinspectionToJson({})).toEqual({});
  });

  test('scheduling emits only what was set', () => {
    expect(
      scheduleReinspectionToJson({
        assignedInspectorId: 8,
        targetDate: '2026-09-20',
        copyAllItems: true,
      })
    ).toEqual({
      assignedInspectorId: 8,
      targetDate: '2026-09-20',
      copyAllItems: true,
    });
    expect(scheduleReinspectionToJson({ copyAllItems: false })).toEqual({
      copyAllItems: false,
    });
  });

  test('the outcome goes over the wire in lower case', () => {
    expect(
      reinspectionOutcomeToJson({ outcome: ReinspectionOutcome.FAILED })
    ).toEqual({ outcome: 'failed' });
    expect(
      reinspectionOutcomeToJson({
        outcome: ReinspectionOutcome.PASSED,
        remarks: 'Conforms.',
      })
    ).toEqual({ outcome: 'passed', remarks: 'Conforms.' });
  });
});

describe('attempt helpers', () => {
  const attempts = [
    attempt({ sequence: 1, outcome: 'failed' }),
    attempt({ sequence: 2, outcome: 'passed' }),
    attempt({ sequence: 3, outcome: 'passed' }),
  ];

  test('passedReinspections offers the latest pass first', () => {
    expect(passedReinspections(attempts).map((a) => a.sequence)).toEqual([
      3, 2,
    ]);
    expect(passedReinspections([attempts[0]])).toEqual([]);
  });

  test('hasPendingReinspection is true only while one is undecided', () => {
    expect(hasPendingReinspection(attempts)).toBe(false);
    expect(
      hasPendingReinspection([...attempts, attempt({ sequence: 4 })])
    ).toBe(true);
    expect(hasPendingReinspection([])).toBe(false);
  });
});
