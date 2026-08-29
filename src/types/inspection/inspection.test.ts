import { describe, expect, test } from 'bun:test';
import {
  parseInspection,
  parseInspectionCheckItem,
  createInspectionToJson,
  updateInspectionToJson,
  defaultInspectionCategoryFor,
  InspectionType,
  InspectionStatus,
  InspectionResult,
  InspectionOrigin,
  InspectionCategory,
  InspectionTrade,
  ComplianceRiskLevel,
  CompliancePhase,
  CheckItemStatus,
} from './inspection';

const UUID = '11111111-1111-1111-1111-111111111111';
const ITEM_UUID = '22222222-2222-2222-2222-222222222222';
const DEFECT_UUID = '33333333-3333-3333-3333-333333333333';

// The inspection enums carry hyphenated wire values (`in-progress`,
// `passed-with-remarks`, `not-applicable`); the boundary must round-trip those
// exact strings rather than the Java constant names.
describe('parseInspection', () => {
  test('parses a valid payload with kebab-case enums and children', () => {
    const inspection = parseInspection({
      id: UUID,
      inspectionNumber: 'INS-001',
      title: 'Slab pour QA',
      type: 'quality',
      status: 'in-progress',
      result: 'passed-with-remarks',
      projectId: 7,
      inspectorId: 12,
      attendees: ['Abin', 'Hrishi'],
      totalCheckPoints: 2,
      passedCheckPoints: 1,
      checkItems: [
        {
          id: ITEM_UUID,
          category: 'Rebar',
          checkPoint: 'Cover maintained',
          status: 'not-applicable',
          photosRequired: true,
          photos: ['a.jpg'],
        },
      ],
      defects: [
        {
          id: DEFECT_UUID,
          description: 'Honeycombing at edge',
          correctiveAction: 'Re-grout',
        },
      ],
    });
    expect(inspection.id).toBe(UUID);
    expect(inspection.type).toBe(InspectionType.QUALITY);
    expect(inspection.status).toBe(InspectionStatus.IN_PROGRESS);
    expect(inspection.result).toBe(InspectionResult.PASSED_WITH_REMARKS);
    expect(inspection.projectId).toBe(7);
    expect(inspection.inspectorId).toBe(12);
    expect(inspection.attendees).toEqual(['Abin', 'Hrishi']);
    expect(inspection.checkItems).toHaveLength(1);
    expect(inspection.checkItems[0]!.status).toBe(CheckItemStatus.NOT_APPLICABLE);
    expect(inspection.defects).toHaveLength(1);
    expect(inspection.defects[0]!.description).toBe('Honeycombing at edge');
  });

  test('parses an unassigned inspector sent as 0 (no inspector) as null', () => {
    const inspection = parseInspection({ id: UUID, inspectorId: 0 });
    expect(inspection.inspectorId).toBeNull();
  });

  test('parses a null inspectorId as null', () => {
    const inspection = parseInspection({ id: UUID, inspectorId: null });
    expect(inspection.inspectorId).toBeNull();
  });

  test('parses an omitted inspectorId as null', () => {
    const inspection = parseInspection({ id: UUID });
    expect(inspection.inspectorId).toBeNull();
  });

  test('round-trips the hyphenated wire values back out', () => {
    const inspection = parseInspection({
      id: UUID,
      inspectorId: 1,
      status: 'passed-with-remarks',
    });
    expect(inspection.status).toBe(InspectionStatus.PASSED_WITH_REMARKS);
    // The enum value is the exact backend wire string, not the constant name.
    expect(String(inspection.status)).toBe('passed-with-remarks');
  });

  test('leaves the result unset when the backend omits it', () => {
    const inspection = parseInspection({ id: UUID, inspectorId: 1 });
    expect(inspection.result).toBeUndefined();
  });

  test('falls back to default enums on an unknown value', () => {
    const inspection = parseInspection({
      id: UUID,
      inspectorId: 1,
      type: 'bogus',
      status: 'bogus',
    });
    expect(inspection.type).toBe(InspectionType.QUALITY);
    expect(inspection.status).toBe(InspectionStatus.SCHEDULED);
  });

  test('rejects a missing id instead of fabricating one', () => {
    expect(() => parseInspection({ inspectorId: 1 })).toThrow();
  });

  test('rejects a blank id', () => {
    expect(() => parseInspection({ id: '   ', inspectorId: 1 })).toThrow();
  });

  test('parses an AI-generated compliance inspection with its fields', () => {
    const inspection = parseInspection({
      id: UUID,
      inspectorId: 1,
      status: 'suggested',
      origin: 'ai-generated',
      compliancePhase: 'pre-construction',
      riskLevel: 'critical',
      resolutionOptions: 'Obtain the fire NOC before excavation.',
      complianceRuleRef: 'TN-FIRE-2019-3.2',
      aiRationale: 'High-rise residential in Tamil Nadu requires a fire NOC.',
    });
    expect(inspection.status).toBe(InspectionStatus.SUGGESTED);
    expect(inspection.origin).toBe(InspectionOrigin.AI_GENERATED);
    expect(inspection.compliancePhase).toBe(CompliancePhase.PRE_CONSTRUCTION);
    expect(inspection.riskLevel).toBe(ComplianceRiskLevel.CRITICAL);
    expect(inspection.resolutionOptions).toBe(
      'Obtain the fire NOC before excavation.'
    );
    expect(inspection.complianceRuleRef).toBe('TN-FIRE-2019-3.2');
    expect(inspection.aiRationale).toBe(
      'High-rise residential in Tamil Nadu requires a fire NOC.'
    );
  });

  test('defaults origin to MANUAL and leaves compliance fields unset', () => {
    const inspection = parseInspection({ id: UUID, inspectorId: 1 });
    expect(inspection.origin).toBe(InspectionOrigin.MANUAL);
    expect(inspection.compliancePhase).toBeUndefined();
    expect(inspection.riskLevel).toBeUndefined();
    expect(inspection.resolutionOptions).toBeUndefined();
    expect(inspection.complianceRuleRef).toBeUndefined();
    expect(inspection.aiRationale).toBeUndefined();
  });

  test('round-trips the compliance enum wire values', () => {
    expect(String(InspectionStatus.SUGGESTED)).toBe('suggested');
    expect(String(InspectionOrigin.AI_GENERATED)).toBe('ai-generated');
    expect(String(ComplianceRiskLevel.MEDIUM)).toBe('medium');
    expect(String(CompliancePhase.POST_CONSTRUCTION)).toBe('post-construction');
  });
});

// The taxonomy the QA/QC views filter on. The category is not nullable on the
// backend and the trade is, which is why one falls back and the other does not.
describe('parseInspection: category and trade', () => {
  test('takes the category and trade the backend sent', () => {
    const inspection = parseInspection({
      id: UUID,
      inspectorId: 1,
      type: 'quality',
      category: 'qa-qc',
      trade: 'shuttering-formwork',
    });
    expect(inspection.category).toBe(InspectionCategory.QA_QC);
    expect(inspection.trade).toBe(InspectionTrade.SHUTTERING_FORMWORK);
  });

  test('derives the category from the type when the payload omits it', () => {
    // An older payload, or one from before the column existed. Falling back to a
    // fixed constant would bucket every legacy safety inspection as QA/QC.
    expect(parseInspection({ id: UUID, type: 'safety' }).category).toBe(
      InspectionCategory.SAFETY
    );
    expect(parseInspection({ id: UUID, type: 'compliance' }).category).toBe(
      InspectionCategory.COMPLIANCE
    );
    expect(parseInspection({ id: UUID, type: 'structural' }).category).toBe(
      InspectionCategory.QA_QC
    );
  });

  test('falls back rather than accepting an unrecognized category', () => {
    const inspection = parseInspection({
      id: UUID,
      type: 'safety',
      category: 'QA_QC',
    });
    // 'QA_QC' is the Java constant name, not the wire value; it must not parse.
    expect(inspection.category).toBe(InspectionCategory.SAFETY);
  });

  test('leaves the trade unset when the backend omits or misspells it', () => {
    expect(parseInspection({ id: UUID }).trade).toBeUndefined();
    expect(
      parseInspection({ id: UUID, trade: 'SHUTTERING_FORMWORK' }).trade
    ).toBeUndefined();
  });

  test('defaultInspectionCategoryFor covers every inspection type', () => {
    for (const type of Object.values(InspectionType)) {
      expect(
        Object.values(InspectionCategory).includes(
          defaultInspectionCategoryFor(type)
        )
      ).toBe(true);
    }
    expect(defaultInspectionCategoryFor(undefined)).toBe(
      InspectionCategory.OTHER
    );
  });

  test('serializes the category and trade only when set', () => {
    const base = {
      title: 'Slab pour QA',
      type: InspectionType.QUALITY,
      scheduledDate: '2026-08-25',
      inspectorId: 8,
    };
    const bare = createInspectionToJson(base);
    expect('category' in bare).toBe(false);
    expect('trade' in bare).toBe(false);

    const full = createInspectionToJson({
      ...base,
      category: InspectionCategory.QA_QC,
      trade: InspectionTrade.REINFORCEMENT,
    });
    expect(full.category).toBe('qa-qc');
    expect(full.trade).toBe('reinforcement');

    const updated = updateInspectionToJson({
      ...base,
      status: InspectionStatus.IN_PROGRESS,
      category: InspectionCategory.OTHER,
      trade: InspectionTrade.ALUMINIUM_UPVC,
    });
    expect(updated.category).toBe('other');
    expect(updated.trade).toBe('aluminium-upvc');
  });
});

// The four measurement fields the backend's InspectionCheckItemDto grew for the
// QA/QC report. `deviation` is computed server-side from the measurement and the
// expected value, so it is read here and never written.
describe('parseInspectionCheckItem: acceptance criteria and measurement', () => {
  test('parses the criterion, tolerance, deviation and BIM element', () => {
    const item = parseInspectionCheckItem({
      id: ITEM_UUID,
      category: 'Reinforcement',
      checkPoint: 'Main bar spacing matches the schedule',
      status: 'failed',
      measurement: '148',
      expectedValue: '150',
      acceptanceCriterion: 'Spacing measured at three locations per bay',
      tolerance: '+/- 10 mm',
      deviation: -2,
      bimElementGuid: '1kTvXnbbzCWw8lcMd1dR4o',
    });
    expect(item.acceptanceCriterion).toBe(
      'Spacing measured at three locations per bay'
    );
    expect(item.tolerance).toBe('+/- 10 mm');
    expect(item.deviation).toBe(-2);
    expect(item.bimElementGuid).toBe('1kTvXnbbzCWw8lcMd1dR4o');
  });

  test('coerces a deviation sent as a BigDecimal string', () => {
    // Jackson may serialize a BigDecimal either way; a string must not become NaN
    // and must not be dropped.
    const item = parseInspectionCheckItem({
      id: ITEM_UUID,
      status: 'passed',
      deviation: '-2.500000',
    });
    expect(item.deviation).toBe(-2.5);
  });

  test('keeps a zero deviation, which means exactly on target', () => {
    const item = parseInspectionCheckItem({
      id: ITEM_UUID,
      status: 'passed',
      deviation: 0,
    });
    expect(item.deviation).toBe(0);
  });

  test('leaves the four unset when the backend omits them', () => {
    const item = parseInspectionCheckItem({ id: ITEM_UUID, status: 'pending' });
    expect(item.acceptanceCriterion).toBeUndefined();
    expect(item.tolerance).toBeUndefined();
    expect(item.deviation).toBeUndefined();
    expect(item.bimElementGuid).toBeUndefined();
  });

  test('sends the criterion, tolerance and BIM guid but never the deviation', () => {
    const json = createInspectionToJson({
      title: 'Slab pour QA',
      type: InspectionType.QUALITY,
      scheduledDate: '2026-08-25',
      inspectorId: 8,
      checkItems: [
        {
          category: 'Reinforcement',
          checkPoint: 'Cover maintained',
          status: CheckItemStatus.PASSED,
          photosRequired: false,
          acceptanceCriterion: 'Measured at three locations',
          tolerance: '+/- 10 mm',
          bimElementGuid: '1kTvXnbbzCWw8lcMd1dR4o',
        },
      ],
    });
    const item = (json.checkItems as Record<string, unknown>[])[0]!;
    expect(item.acceptanceCriterion).toBe('Measured at three locations');
    expect(item.tolerance).toBe('+/- 10 mm');
    expect(item.bimElementGuid).toBe('1kTvXnbbzCWw8lcMd1dR4o');
    // The backend computes it and its request record has no such component.
    expect('deviation' in item).toBe(false);
  });
});
