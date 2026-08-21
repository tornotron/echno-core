import { describe, expect, test } from 'bun:test';
import {
  parseInspection,
  InspectionType,
  InspectionStatus,
  InspectionResult,
  InspectionOrigin,
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
