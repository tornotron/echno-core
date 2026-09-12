/**
 * The observation contract (be #778/#780/#781, core #106). Every test here
 * fails without the code: the module does not exist on `development`, and
 * neither defect nor NCR carries `observationId`.
 */
import { describe, expect, test } from 'bun:test';
import { parseInspectionDefect, parseNcr, CheckItemStatus, DefectSeverity } from './index';
import {
  ObservationDecision,
  ObservationOutcomeKind,
  ObservationReviewStatus,
  ObservationSource,
  createObservationToJson,
  hasObservationChanges,
  isObservationPending,
  observationAttachmentIds,
  parseObservation,
  reviewObservationToJson,
} from './observation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const OBS = '11111111-1111-1111-1111-111111111111';
const INSP = '22222222-2222-2222-2222-222222222222';
const NODE = '33333333-3333-3333-3333-333333333333';
const ITEM = '44444444-4444-4444-4444-444444444444';

const aiRow: Raw = {
  id: OBS,
  projectId: 7,
  inspectionId: null,
  spatialNodeId: NODE,
  spatialPath: [
    { id: 'b', level: 'BUILDING', code: 'B1', name: 'Block B' },
    { id: NODE, level: 'ZONE', code: 'Z1', name: 'Zone 1' },
  ],
  source: 'ai',
  modelName: 'claude',
  modelVersion: '2026-09',
  confidence: 0.82,
  observedAt: '2026-09-12T10:00:00Z',
  title: 'Fire exit obstructed',
  description: 'Rationale from the model',
  suggestedSeverity: 'major',
  evidenceRefs: [{ attachmentId: 41 }, { frame: 12, captureId: 'c-9' }],
  reviewStatus: 'pending',
  outcomeKind: 'inspection',
  outcomeRef: INSP,
};

describe('parseObservation', () => {
  test('reads an AI observation with its model, confidence, breadcrumb and evidence', () => {
    const obs = parseObservation(aiRow);
    expect(obs.id).toBe(OBS);
    expect(obs.source).toBe(ObservationSource.AI);
    expect(obs.modelName).toBe('claude');
    expect(obs.confidence).toBe(0.82);
    expect(obs.inspectionId).toBeUndefined();
    expect(obs.spatialPath.map((s) => s.code)).toEqual(['B1', 'Z1']);
    expect(obs.suggestedSeverity).toBe(DefectSeverity.MAJOR);
    expect(obs.reviewStatus).toBe(ObservationReviewStatus.PENDING);
    expect(obs.outcomeKind).toBe(ObservationOutcomeKind.INSPECTION);
    expect(obs.outcomeRef).toBe(INSP);
    expect(observationAttachmentIds(obs)).toEqual([41]);
    expect(isObservationPending(obs)).toBe(true);
  });

  test('a modified observation keeps the diff as field/before/after', () => {
    const obs = parseObservation({
      ...aiRow,
      reviewStatus: 'modified',
      reviewChanges: [{ field: 'severity', before: 'major', after: 'critical' }],
      reviewNote: 'Worse than it looks',
    });
    expect(obs.reviewStatus).toBe(ObservationReviewStatus.MODIFIED);
    expect(obs.reviewChanges).toEqual([
      { field: 'severity', before: 'major', after: 'critical' },
    ]);
    expect(isObservationPending(obs)).toBe(false);
  });

  test('unreadable enums fall back to human, pending and none', () => {
    const obs = parseObservation({
      id: OBS,
      title: 'x',
      source: 'satellite',
      reviewStatus: 'maybe',
      outcomeKind: 'ticket',
      suggestedSeverity: null,
    });
    expect(obs.source).toBe(ObservationSource.HUMAN);
    expect(obs.reviewStatus).toBe(ObservationReviewStatus.PENDING);
    expect(obs.outcomeKind).toBe(ObservationOutcomeKind.NONE);
    expect(obs.suggestedSeverity).toBeUndefined();
    expect(obs.evidenceRefs).toEqual([]);
    expect(obs.reviewChanges).toEqual([]);
  });

  test('refuses a row with no id', () => {
    expect(() => parseObservation({ title: 'x' })).toThrow(TypeError);
  });
});

describe('createObservationToJson', () => {
  test('writes the required pair and only the optional fields set', () => {
    expect(createObservationToJson({ projectId: 7, title: 'Crack' })).toEqual({
      projectId: 7,
      title: 'Crack',
    });
    expect(
      createObservationToJson({
        projectId: 7,
        title: 'Crack',
        inspectionId: INSP,
        spatialNodeId: NODE,
        suggestedSeverity: DefectSeverity.MINOR,
        evidenceAttachmentIds: [41, 42],
      })
    ).toEqual({
      projectId: 7,
      title: 'Crack',
      inspectionId: INSP,
      spatialNodeId: NODE,
      suggestedSeverity: 'minor',
      evidenceAttachmentIds: [41, 42],
    });
  });
});

describe('reviewObservationToJson', () => {
  test('accept with a check-item outcome', () => {
    expect(
      reviewObservationToJson({
        decision: ObservationDecision.ACCEPT,
        outcome: {
          kind: ObservationOutcomeKind.CHECK_ITEM,
          checkItemId: ITEM,
          status: CheckItemStatus.FAILED,
        },
      })
    ).toEqual({
      decision: 'accept',
      outcome: { kind: 'check-item', checkItemId: ITEM, status: 'failed' },
    });
  });

  test('accept creating a defect serialises the defect request', () => {
    const json = reviewObservationToJson({
      decision: ObservationDecision.ACCEPT,
      outcome: {
        kind: ObservationOutcomeKind.DEFECT,
        defect: { description: 'Honeycombing', correctiveAction: 'Grout', severity: 'major' },
      },
    });
    expect(json.outcome).toEqual({
      kind: 'defect',
      defect: { description: 'Honeycombing', correctiveAction: 'Grout', severity: 'major' },
    });
  });

  test('reject needs a note and drops the outcome', () => {
    expect(() =>
      reviewObservationToJson({ decision: ObservationDecision.REJECT })
    ).toThrow(TypeError);
    expect(() =>
      reviewObservationToJson({ decision: ObservationDecision.REJECT, note: '   ' })
    ).toThrow(TypeError);
    expect(
      reviewObservationToJson({
        decision: ObservationDecision.REJECT,
        note: 'False positive',
        outcome: { kind: ObservationOutcomeKind.NONE },
      })
    ).toEqual({ decision: 'reject', note: 'False positive' });
  });

  test('modify needs at least one change and sends the diff', () => {
    expect(hasObservationChanges({})).toBe(false);
    expect(hasObservationChanges({ title: 'x' })).toBe(true);
    expect(() =>
      reviewObservationToJson({ decision: ObservationDecision.MODIFY, changes: {} })
    ).toThrow(TypeError);
    expect(
      reviewObservationToJson({
        decision: ObservationDecision.MODIFY,
        changes: { severity: DefectSeverity.CRITICAL, spatialNodeId: NODE },
        outcome: { kind: ObservationOutcomeKind.INSPECTION, inspectionId: INSP },
      })
    ).toEqual({
      decision: 'modify',
      changes: { severity: 'critical', spatialNodeId: NODE },
      outcome: { kind: 'inspection', inspectionId: INSP },
    });
  });
});

describe('reverse links', () => {
  test('a defect and an NCR carry the observation they came from', () => {
    const defect = parseInspectionDefect({
      id: '5f0e0d0c-0b0a-4908-8706-050403020100',
      description: 'Honeycombing',
      correctiveAction: 'Grout',
      observationId: OBS,
    });
    expect(defect.observationId).toBe(OBS);
    const ncr = parseNcr({
      id: '6f0e0d0c-0b0a-4908-8706-050403020100',
      inspectionId: INSP,
      observationId: OBS,
    });
    expect(ncr.observationId).toBe(OBS);
    expect(parseNcr({ id: '6f0e0d0c-0b0a-4908-8706-050403020100', inspectionId: INSP }).observationId).toBeUndefined();
  });
});
