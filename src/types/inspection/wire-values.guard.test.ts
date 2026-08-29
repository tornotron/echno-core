/**
 * Source-level guard on the wire values of every inspection-module enum.
 *
 * The failure this exists for is specific and has already happened once. The
 * contract is hand-maintained with no codegen against the backend, so an enum
 * written with the Java constant name instead of its `@JsonValue` string
 * (`QA_QC` for `qa-qc`, `CORRECTIVE_ACTION_COMPLETE` for
 * `corrective-action-complete`) typechecks, parses, renders, and fails on every
 * request at runtime with a 400. Nothing in a unit test of the parser catches
 * it either, because the parser is only ever handed the same wrong string the
 * enum declares.
 *
 * So the check is against a table transcribed from the Java enums rather than
 * against the code under test. Two rules:
 *
 * 1. Every enum declared under `types/inspection` appears in {@link PINNED} with
 *    exactly its members and their values. A rename on either side is then a
 *    failure that names the field, not a silent 400 in production.
 * 2. Every value is hyphenated lowercase. This one holds for enums that have not
 *    been pinned yet as well, so a new enum cannot ship SCREAMING_SNAKE in the
 *    window before somebody transcribes it.
 *
 * A guard rather than a set of assertions in each module's test file, for the
 * reason `date-serialization.guard.test.ts` gives: a test covers the enum
 * somebody remembered, a scan covers the ones nobody did.
 *
 * When the backend genuinely changes a wire value, update the table in the same
 * commit as the enum, and treat the diff as the breaking change it is.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The module whose enums cross the wire. */
const MODULE_DIR = import.meta.dir;

/** A backend `@JsonValue`: lowercase words joined by single hyphens. */
const WIRE_VALUE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Transcribed from the Java enums on `echno-backend` `development`, verified
 * 29 Aug 2026. The comment on each says where it lives.
 */
const PINNED: Record<string, Record<string, string>> = {
  // inspection/InspectionType.java
  InspectionType: {
    SAFETY: 'safety',
    QUALITY: 'quality',
    PROGRESS: 'progress',
    FINAL: 'final',
    STRUCTURAL: 'structural',
    ELECTRICAL: 'electrical',
    PLUMBING: 'plumbing',
    FINISHING: 'finishing',
    COMPLIANCE: 'compliance',
  },
  // inspection/InspectionCategory.java
  InspectionCategory: {
    SAFETY: 'safety',
    QA_QC: 'qa-qc',
    COMPLIANCE: 'compliance',
    OTHER: 'other',
  },
  // inspection/InspectionTrade.java, one value per FR-QA requirement.
  InspectionTrade: {
    PRE_CONSTRUCTION_DOCUMENTATION: 'pre-construction-documentation',
    SHUTTERING_FORMWORK: 'shuttering-formwork',
    REINFORCEMENT: 'reinforcement',
    RCC: 'rcc',
    MASONRY: 'masonry',
    PLASTERING: 'plastering',
    WATERPROOFING: 'waterproofing',
    FLOORING: 'flooring',
    FABRICATION: 'fabrication',
    ALUMINIUM_UPVC: 'aluminium-upvc',
    ELECTRICAL_FIXTURES: 'electrical-fixtures',
    PLUMBING_FIXTURES: 'plumbing-fixtures',
    SANITARY_FIXTURES: 'sanitary-fixtures',
    FINISHING: 'finishing',
    DIMENSIONAL_CHECK: 'dimensional-check',
    PROGRESS_CHECK: 'progress-check',
  },
  // inspection/InspectionStatus.java
  InspectionStatus: {
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
    PASSED: 'passed',
    PASSED_WITH_REMARKS: 'passed-with-remarks',
    CANCELLED: 'cancelled',
    SUGGESTED: 'suggested',
  },
  // inspection/InspectionResult.java
  InspectionResult: {
    PASSED: 'passed',
    FAILED: 'failed',
    PASSED_WITH_REMARKS: 'passed-with-remarks',
    PENDING: 'pending',
  },
  // inspection/InspectionOrigin.java
  InspectionOrigin: {
    MANUAL: 'manual',
    AI_GENERATED: 'ai-generated',
  },
  // inspection/ComplianceRiskLevel.java
  ComplianceRiskLevel: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
  // compliance/CompliancePhase.java
  CompliancePhase: {
    PRE_CONSTRUCTION: 'pre-construction',
    ONGOING: 'ongoing',
    POST_CONSTRUCTION: 'post-construction',
  },
  // inspection/CheckItemStatus.java
  CheckItemStatus: {
    PASSED: 'passed',
    FAILED: 'failed',
    NOT_APPLICABLE: 'not-applicable',
    PENDING: 'pending',
  },
  // inspection/DefectSeverity.java
  DefectSeverity: {
    CRITICAL: 'critical',
    MAJOR: 'major',
    MINOR: 'minor',
  },
  // inspection/DefectStatus.java
  DefectStatus: {
    OPEN: 'open',
    IN_PROGRESS: 'in-progress',
    RESOLVED: 'resolved',
    VERIFIED: 'verified',
  },
  // inspection/DefectAnnotationShape.java
  DefectAnnotationShape: {
    RECTANGLE: 'rectangle',
    ELLIPSE: 'ellipse',
    ARROW: 'arrow',
  },
  // inspection/NcrType.java
  NcrType: {
    QUALITY: 'quality',
    SAFETY: 'safety',
  },
  // inspection/NcrStatus.java
  NcrStatus: {
    OPEN: 'open',
    ASSIGNED: 'assigned',
    CORRECTIVE_ACTION_COMPLETE: 'corrective-action-complete',
    VERIFIED: 'verified',
    CLOSED: 'closed',
    REJECTED: 'rejected',
    REOPENED: 'reopened',
  },
};

/**
 * Reads every `export enum` declared in the module's non-test sources.
 *
 * A source scan rather than a runtime import because a TypeScript string enum
 * compiles to a plain object, indistinguishable at runtime from the label maps
 * that sit beside it in these files.
 */
function declaredEnums(): Record<string, Record<string, string>> {
  const found: Record<string, Record<string, string>> = {};
  const files = readdirSync(MODULE_DIR).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts')
  );

  for (const file of files) {
    const source = readFileSync(join(MODULE_DIR, file), 'utf8');
    const blocks = source.matchAll(/export enum (\w+)\s*\{([^}]*)\}/g);
    for (const [, name, body] of blocks) {
      const members: Record<string, string> = {};
      for (const [, member, value] of (body ?? '').matchAll(
        /(\w+)\s*=\s*'([^']*)'/g
      )) {
        members[member!] = value!;
      }
      found[name!] = members;
    }
  }
  return found;
}

const ENUMS = declaredEnums();

describe('inspection enum wire values', () => {
  test('the scan finds the module enums at all', () => {
    // Cheap insurance: a regex that silently stops matching would otherwise turn
    // this whole file into a test that always passes.
    expect(Object.keys(ENUMS).length).toBeGreaterThanOrEqual(
      Object.keys(PINNED).length
    );
  });

  test('every value is hyphenated lowercase, never a Java constant name', () => {
    const offenders: string[] = [];
    for (const [name, members] of Object.entries(ENUMS)) {
      for (const [member, value] of Object.entries(members)) {
        if (!WIRE_VALUE.test(value)) {
          offenders.push(`  ${name}.${member} = '${value}'`);
        }
      }
    }

    expect(
      offenders.length === 0
        ? ''
        : 'These enum values are not the hyphenated lowercase form the backend\n' +
            'emits and accepts through @JsonValue. A request carrying one is\n' +
            'rejected with a 400 and a response carrying one silently falls back\n' +
            'to the parser default.\n\n' +
            offenders.join('\n')
    ).toBe('');
  });

  test('every declared enum is pinned against the backend', () => {
    const unpinned = Object.keys(ENUMS).filter((name) => !(name in PINNED));

    expect(
      unpinned.length === 0
        ? ''
        : 'These enums cross the wire but are not in the pinned table, so nothing\n' +
            'checks their values against the Java enum they mirror. Transcribe\n' +
            'them from echno-backend and add them to PINNED.\n\n' +
            unpinned.map((n) => `  ${n}`).join('\n')
    ).toBe('');
  });

  for (const [name, expected] of Object.entries(PINNED)) {
    test(`${name} matches the backend enum exactly`, () => {
      expect(ENUMS[name]).toEqual(expected);
    });
  }
});
