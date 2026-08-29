import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  assignNcrToJson,
  availableNcrActions,
  createNcrToJson,
  isNcrOverdue,
  ncrDaysOverdue,
  ncrRemarksToJson,
  NcrStatus,
  NcrType,
  parseNcr,
  SETTLED_NCR_STATUSES,
} from './ncr';
import { DefectSeverity } from './inspection';

const UUID = '11111111-1111-1111-1111-111111111111';
const INSPECTION_UUID = '22222222-2222-2222-2222-222222222222';
const DEFECT_UUID = '33333333-3333-3333-3333-333333333333';

function ncr(overrides: Record<string, unknown> = {}) {
  return parseNcr({
    id: UUID,
    inspectionId: INSPECTION_UUID,
    ...overrides,
  });
}

/** A local calendar date `days` away from today, as the backend sends it. */
function localDateOffsetByDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('parseNcr', () => {
  test('parses a full payload with its hyphenated wire values', () => {
    const report = ncr({
      ncrNumber: 'NCR-0007',
      type: 'safety',
      defectId: DEFECT_UUID,
      title: 'Cover to slab reinforcement below specification',
      description: 'Clear cover measured at 25 mm against a specified 40 mm.',
      severity: 'major',
      status: 'corrective-action-complete',
      siteEngineerId: 8,
      targetDate: '2026-09-10',
      raisedById: 3,
      verifiedById: 5,
      closedById: 9,
      correctiveActionRemarks: 'Section chipped out and re-poured.',
      verificationRemarks: 'Cover re-measured at 42 mm.',
      correctiveActionCompletedAt: '2026-09-05T10:00:00',
      verifiedAt: '2026-09-06T09:30:00',
      closedAt: '2026-09-07T15:00:00',
    });
    expect(report.ncrNumber).toBe('NCR-0007');
    expect(report.type).toBe(NcrType.SAFETY);
    expect(report.defectId).toBe(DEFECT_UUID);
    expect(report.severity).toBe(DefectSeverity.MAJOR);
    expect(report.status).toBe(NcrStatus.CORRECTIVE_ACTION_COMPLETE);
    expect(String(report.status)).toBe('corrective-action-complete');
    expect(report.siteEngineerId).toBe(8);
    expect(report.raisedById).toBe(3);
    expect(report.closedById).toBe(9);
    expect(report.verificationRemarks).toBe('Cover re-measured at 42 mm.');
  });

  // The field the whole issue named: the verifier and the closer are separate
  // accounts on the backend, and dropping one collapses the accountability trail
  // the report exists to carry.
  test('carries verifiedById, distinct from raisedById and closedById', () => {
    const report = ncr({ raisedById: 3, verifiedById: 5, closedById: 9 });
    expect(report.verifiedById).toBe(5);
    expect(report.raisedById).toBe(3);
    expect(report.closedById).toBe(9);
  });

  test('leaves verifiedById unset before the work has been accepted', () => {
    const report = ncr({ status: 'assigned', raisedById: 3 });
    expect(report.verifiedById).toBeUndefined();
    expect(report.verifiedAt).toBeUndefined();
  });

  test('defaults an unreadable status to OPEN rather than to a settled state', () => {
    expect(ncr({ status: 'ASSIGNED' }).status).toBe(NcrStatus.OPEN);
    expect(ncr({}).status).toBe(NcrStatus.OPEN);
  });

  test('defaults an unreadable severity to MINOR', () => {
    expect(ncr({ severity: 'CRITICAL' }).severity).toBe(DefectSeverity.MINOR);
  });

  test('defaults an unreadable type to QUALITY', () => {
    expect(ncr({ type: 'SAFETY' }).type).toBe(NcrType.QUALITY);
  });

  test('rejects a missing id or inspectionId instead of fabricating one', () => {
    expect(() => parseNcr({ inspectionId: INSPECTION_UUID })).toThrow();
    expect(() => parseNcr({ id: UUID })).toThrow();
  });
});

describe('NCR request serializers', () => {
  test('emits the required create fields and only the optional ones set', () => {
    const bare = createNcrToJson({
      inspectionId: INSPECTION_UUID,
      title: 'Cover below specification',
      description: 'Measured at 25 mm against 40 mm.',
    });
    expect(bare.inspectionId).toBe(INSPECTION_UUID);
    expect('defectId' in bare).toBe(false);
    expect('severity' in bare).toBe(false);
    // Neither the number, the type nor the raiser is ever sent: all server-set.
    expect('ncrNumber' in bare).toBe(false);
    expect('type' in bare).toBe(false);
    expect('raisedById' in bare).toBe(false);
    // Nor the status: it is moved only through the transition endpoints.
    expect('status' in bare).toBe(false);

    const full = createNcrToJson({
      inspectionId: INSPECTION_UUID,
      defectId: DEFECT_UUID,
      title: 'Cover below specification',
      description: 'Measured at 25 mm against 40 mm.',
      severity: DefectSeverity.CRITICAL,
      siteEngineerId: 8,
      targetDate: '2026-09-10',
    });
    expect(full.severity).toBe('critical');
    expect(full.siteEngineerId).toBe(8);
    expect(full.targetDate).toBe('2026-09-10');
  });

  test('assign always sends the engineer and the date only when given', () => {
    expect(assignNcrToJson({ siteEngineerId: 8 })).toEqual({
      siteEngineerId: 8,
    });
    expect(
      assignNcrToJson({ siteEngineerId: 8, targetDate: '2026-09-10' })
    ).toEqual({ siteEngineerId: 8, targetDate: '2026-09-10' });
  });

  test('a lifecycle step with no note still sends a valid body', () => {
    expect(ncrRemarksToJson()).toEqual({});
    expect(ncrRemarksToJson({})).toEqual({});
    expect(ncrRemarksToJson({ remarks: 'Re-poured.' })).toEqual({
      remarks: 'Re-poured.',
    });
  });
});

// Mirrors the backend transition table. A button offered for a move the backend
// refuses is a 400 the user cannot act on, so this is worth pinning exactly.
describe('availableNcrActions', () => {
  test('open reports can only be assigned', () => {
    expect(availableNcrActions(NcrStatus.OPEN)).toEqual(['assign']);
  });

  test('assigned work can be reported complete or moved to another engineer', () => {
    expect(availableNcrActions(NcrStatus.ASSIGNED)).toEqual([
      'corrective-action-complete',
      'assign',
    ]);
  });

  test('completed work is either accepted or sent back', () => {
    expect(availableNcrActions(NcrStatus.CORRECTIVE_ACTION_COMPLETE)).toEqual([
      'verify',
      'reject',
    ]);
  });

  test('verification is not closure: closing is a separate act', () => {
    expect(availableNcrActions(NcrStatus.VERIFIED)).toEqual(['close', 'reopen']);
  });

  test('a closed report can only be reopened', () => {
    expect(availableNcrActions(NcrStatus.CLOSED)).toEqual(['reopen']);
  });

  test('rejected and reopened work must be reassigned before it is reported again', () => {
    expect(availableNcrActions(NcrStatus.REJECTED)).toEqual(['assign']);
    expect(availableNcrActions(NcrStatus.REOPENED)).toEqual(['assign']);
  });

  test('every status offers at least one move, so nothing is a dead end', () => {
    for (const status of Object.values(NcrStatus)) {
      expect(availableNcrActions(status).length).toBeGreaterThan(0);
    }
  });
});

// The target date is a backend LocalDate. Read with `new Date(...)` it would be
// midnight UTC, which is the previous day in every zone west of Greenwich and
// makes a report look a day late. The runner defaults to UTC, where the bug is
// invisible, so the zone is pinned to one with a negative offset.
describe('NCR overdue arithmetic', () => {
  const originalTimeZone =
    process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });

  afterAll(() => {
    process.env.TZ = originalTimeZone;
  });

  test('a report due today is not overdue until tomorrow', () => {
    const report = ncr({
      status: 'assigned',
      targetDate: localDateOffsetByDays(0),
    });
    expect(isNcrOverdue(report)).toBe(false);
    expect(ncrDaysOverdue(report)).toBe(0);
  });

  test('counts the whole days a report is past its target date', () => {
    const report = ncr({
      status: 'assigned',
      targetDate: localDateOffsetByDays(-3),
    });
    expect(isNcrOverdue(report)).toBe(true);
    expect(ncrDaysOverdue(report)).toBe(3);
  });

  test('a report due in the future is not overdue', () => {
    const report = ncr({
      status: 'open',
      targetDate: localDateOffsetByDays(5),
    });
    expect(isNcrOverdue(report)).toBe(false);
    expect(ncrDaysOverdue(report)).toBe(0);
  });

  test('a settled report is never overdue, however old its target date', () => {
    for (const status of SETTLED_NCR_STATUSES) {
      const report = ncr({ status, targetDate: '2020-01-01' });
      expect(isNcrOverdue(report)).toBe(false);
      expect(ncrDaysOverdue(report)).toBe(0);
    }
  });

  test('a report with no target date is never overdue', () => {
    expect(isNcrOverdue(ncr({ status: 'assigned' }))).toBe(false);
  });

  test('an unparseable target date is not treated as overdue', () => {
    expect(
      isNcrOverdue(ncr({ status: 'assigned', targetDate: 'not a date' }))
    ).toBe(false);
  });
});
