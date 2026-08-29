/**
 * @module types/inspection/ncr
 *
 * The non-conformance report raised against an inspection (backend `NcrDto`),
 * served from `/ncrs/web`.
 *
 * An NCR is a first-class entity, keyed by UUID like the inspection itself, with
 * its own number series. Two consequences shape everything here.
 *
 * **The status is not settable.** The backend exposes one endpoint per
 * lifecycle transition and refuses anything the graph does not allow, so there
 * is no update request in this module and no `status` field on any payload. The
 * UI offers actions rather than a status picker; {@link availableNcrActions}
 * says which are legal from a given state, mirroring the backend's transition
 * table so a button is never offered for a call that would be rejected.
 *
 * **The link to the defect is a scalar, not a reference.** An inspection's
 * defects are cleared and rebuilt on every save, so `defectId` records which
 * defect row the report came from at the time it was raised and may no longer
 * match a live row. Read it as provenance, not as a foreign key.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import { parseLocalDate } from '../../lib/utils/date-helpers';
import {
  backendDate,
  nullableString,
  optionalNumericId,
  opaque,
} from '../../lib/validation/backend-schema';
import { DefectSeverity, parseDefectSeverity } from './inspection';

/**
 * Whether a non-conformance is a quality or a safety matter. Not a label: it
 * decides who may close the report, a QA engineer or a safety officer, and
 * neither may close the other's. Fixed when the NCR is raised, derived
 * server-side from the originating inspection's category.
 */
export enum NcrType {
  QUALITY = 'quality',
  SAFETY = 'safety',
}

/**
 * Where a non-conformance report has reached in its lifecycle.
 *
 * The usual path is `OPEN -> ASSIGNED -> CORRECTIVE_ACTION_COMPLETE ->
 * VERIFIED -> CLOSED`, with two ways out of the straight line. `REJECTED` is
 * where a verifier puts work that was declared complete but is not acceptable,
 * and it goes back to the site engineer. `REOPENED` is where the report goes
 * when the same non-conformance is found again after being verified or closed,
 * which is a real outcome on site and is deliberately not recorded by raising a
 * second NCR: the history of the first one is the evidence that it recurred.
 */
export enum NcrStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  CORRECTIVE_ACTION_COMPLETE = 'corrective-action-complete',
  VERIFIED = 'verified',
  CLOSED = 'closed',
  REJECTED = 'rejected',
  REOPENED = 'reopened',
}

/** Human-readable label for each {@link NcrType}. */
export const ncrTypeLabels: Record<NcrType, string> = {
  [NcrType.QUALITY]: 'Quality',
  [NcrType.SAFETY]: 'Safety',
};

/** Human-readable label for each {@link NcrStatus}. */
export const ncrStatusLabels: Record<NcrStatus, string> = {
  [NcrStatus.OPEN]: 'Open',
  [NcrStatus.ASSIGNED]: 'Assigned',
  [NcrStatus.CORRECTIVE_ACTION_COMPLETE]: 'Corrective Action Complete',
  [NcrStatus.VERIFIED]: 'Verified',
  [NcrStatus.CLOSED]: 'Closed',
  [NcrStatus.REJECTED]: 'Rejected',
  [NcrStatus.REOPENED]: 'Reopened',
};

/**
 * Narrows an untyped backend string to {@link NcrType}, defaulting to `QUALITY`
 * when the value is absent or unrecognized.
 */
export function parseNcrType(raw: unknown): NcrType {
  return typeof raw === 'string' &&
    (Object.values(NcrType) as string[]).includes(raw)
    ? (raw as NcrType)
    : NcrType.QUALITY;
}

/**
 * Narrows an untyped backend string to {@link NcrStatus}, defaulting to `OPEN`
 * when the value is absent or unrecognized. `OPEN` is the state a report starts
 * in, so an unreadable one is treated as outstanding rather than as settled.
 */
export function parseNcrStatus(raw: unknown): NcrStatus {
  return typeof raw === 'string' &&
    (Object.values(NcrStatus) as string[]).includes(raw)
    ? (raw as NcrStatus)
    : NcrStatus.OPEN;
}

const NcrSchema = z.object({
  id: z.string().nullish(),
  ncrNumber: nullableString,
  type: opaque,
  inspectionId: z.string().nullish(),
  defectId: nullableString,
  title: nullableString,
  description: nullableString,
  severity: opaque,
  status: opaque,
  siteEngineerId: optionalNumericId,
  targetDate: backendDate,
  raisedById: optionalNumericId,
  verifiedById: optionalNumericId,
  closedById: optionalNumericId,
  correctiveActionRemarks: nullableString,
  verificationRemarks: nullableString,
  correctiveActionCompletedAt: backendDate,
  verifiedAt: backendDate,
  closedAt: backendDate,
  createdAt: backendDate,
  updatedAt: backendDate,
});

/**
 * A non-conformance report.
 *
 * Always traceable to the inspection that found it, and to the defect row it
 * came from when there was one. The corrective and verification remarks are two
 * distinct fields because the backend records the corrector's account and the
 * verifier's account separately, and the timeline shows both.
 */
export interface Ncr {
  /** UUID primary key. */
  id: string;
  /** Human-facing NCR number, server-assigned from the `NCR` series. */
  ncrNumber: string;
  /** Discipline, derived from the originating inspection's category. */
  type: NcrType;
  /** The inspection this NCR was raised against. */
  inspectionId: string;
  /**
   * The defect row it came from, when it came from one. Provenance rather than
   * a live reference: an inspection's defects are rebuilt on every save.
   */
  defectId?: string;
  /** Short title of the non-conformance. */
  title: string;
  /** What does not conform, and against what requirement. */
  description: string;
  /** Severity, inherited from the defect. */
  severity: DefectSeverity;
  /** Lifecycle state. Changed only through the transition endpoints. */
  status: NcrStatus;
  /** Employee accountable for the corrective work. */
  siteEngineerId?: number;
  /** Date the corrective work is due (`YYYY-MM-DD`). */
  targetDate?: string;
  /** Employee who raised the report. */
  raisedById?: number;
  /**
   * Employee who re-inspected the corrective work and accepted it. Set at the
   * verify step, and distinct from whoever later closed the report.
   */
  verifiedById?: number;
  /** Employee who closed the report. */
  closedById?: number;
  /** What the site engineer did, recorded at the corrective-action step. */
  correctiveActionRemarks?: string;
  /** Why the verifier accepted, rejected or reopened the work. */
  verificationRemarks?: string;
  /** When the corrective work was declared complete (ISO string). */
  correctiveActionCompletedAt?: string;
  /** When the work was accepted (ISO string). */
  verifiedAt?: string;
  /** When the report was closed (ISO string). */
  closedAt?: string;
  /** Creation timestamp (ISO string). */
  createdAt?: string;
  /** Last-update timestamp (ISO string). */
  updatedAt?: string;
}

/**
 * Parses a raw NCR payload into a typed {@link Ncr}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Ncr`.
 * @throws {TypeError} If `id` or `inspectionId` is missing or not a non-empty
 *   string.
 */
export function parseNcr(json: unknown): Ncr {
  const raw = NcrSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseNcr.id'),
    ncrNumber: raw.ncrNumber ?? '',
    type: parseNcrType(raw.type),
    inspectionId: parseUuid(raw.inspectionId, 'parseNcr.inspectionId'),
    defectId: raw.defectId ?? undefined,
    title: raw.title ?? '',
    description: raw.description ?? '',
    severity: parseDefectSeverity(raw.severity),
    status: parseNcrStatus(raw.status),
    siteEngineerId: raw.siteEngineerId ?? undefined,
    targetDate: raw.targetDate ?? undefined,
    raisedById: raw.raisedById ?? undefined,
    verifiedById: raw.verifiedById ?? undefined,
    closedById: raw.closedById ?? undefined,
    correctiveActionRemarks: raw.correctiveActionRemarks ?? undefined,
    verificationRemarks: raw.verificationRemarks ?? undefined,
    correctiveActionCompletedAt: raw.correctiveActionCompletedAt ?? undefined,
    verifiedAt: raw.verifiedAt ?? undefined,
    closedAt: raw.closedAt ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

/**
 * Fields for raising an NCR. The number, the type and the raiser are all set
 * server-side, so none of them appears here; the status starts at `OPEN`, or
 * `ASSIGNED` when a site engineer is named, which is the usual case.
 */
export interface CreateNcrRequest {
  /** The inspection the non-conformance was found on. Required. */
  inspectionId: string;
  /** The defect row it is about, when it is about one. */
  defectId?: string;
  /** Short title (max 200). Required. */
  title: string;
  /** What does not conform, and against what requirement (max 2000). Required. */
  description: string;
  /** Severity of the non-conformance. */
  severity?: DefectSeverity;
  /** Site engineer the corrective work is assigned to. */
  siteEngineerId?: number;
  /** Date the corrective work is due (`YYYY-MM-DD`). */
  targetDate?: string;
}

/** Assigns an NCR to the engineer who will carry out the correction. */
export interface AssignNcrRequest {
  /** Employee who owns the corrective work. Required. */
  siteEngineerId: number;
  /** Date the corrective work is due (`YYYY-MM-DD`). */
  targetDate?: string;
}

/**
 * The note that accompanies a step in the lifecycle: what the site engineer did,
 * or why a verifier sent the work back or reopened the report. One shape for all
 * of them, because the meaning is given by the step it is sent to.
 */
export interface NcrRemarksRequest {
  /** What was done, or why the work was not accepted (max 2000). */
  remarks?: string;
}

/**
 * Serializes a {@link CreateNcrRequest} into the backend request body. Required
 * fields are always emitted; optional inputs only when set.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend `CreateNcrRequest`.
 */
export function createNcrToJson(dto: CreateNcrRequest): Record<string, unknown> {
  const json: Record<string, unknown> = {
    inspectionId: dto.inspectionId,
    title: dto.title,
    description: dto.description,
  };
  if (dto.defectId !== undefined) json.defectId = dto.defectId;
  if (dto.severity !== undefined) json.severity = dto.severity;
  if (dto.siteEngineerId !== undefined) json.siteEngineerId = dto.siteEngineerId;
  if (dto.targetDate !== undefined) json.targetDate = dto.targetDate;
  return json;
}

/**
 * Serializes an {@link AssignNcrRequest} into the backend request body.
 *
 * @param dto - The assignment to serialize.
 * @returns A plain object matching the backend `AssignNcrRequest`.
 */
export function assignNcrToJson(dto: AssignNcrRequest): Record<string, unknown> {
  const json: Record<string, unknown> = {
    siteEngineerId: dto.siteEngineerId,
  };
  if (dto.targetDate !== undefined) json.targetDate = dto.targetDate;
  return json;
}

/**
 * Serializes an {@link NcrRemarksRequest} into the backend request body. Always
 * returns an object, so a step taken without a note still sends a valid body.
 *
 * @param dto - The note, or nothing.
 * @returns A plain object matching the backend `NcrRemarksRequest`.
 */
export function ncrRemarksToJson(
  dto?: NcrRemarksRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (dto?.remarks !== undefined) json.remarks = dto.remarks;
  return json;
}

/**
 * The states in which a report is done with, so nothing about it can still run
 * late.
 */
export const SETTLED_NCR_STATUSES: ReadonlySet<NcrStatus> = new Set<NcrStatus>([
  NcrStatus.VERIFIED,
  NcrStatus.CLOSED,
]);

/**
 * Whether an NCR has passed its target date without being settled.
 *
 * Compared against the start of today, so one due today is not overdue until
 * tomorrow: site teams work to the day, not to the minute. The target date is a
 * backend `LocalDate`, so it is read with `parseLocalDate` rather than by
 * constructing a `Date` from the string, which would land on the previous day in
 * any zone west of Greenwich.
 *
 * @param ncr - The report to judge.
 * @returns `true` when the report is outstanding and its target date has passed.
 */
export function isNcrOverdue(ncr: Ncr): boolean {
  return ncrDaysOverdue(ncr) > 0;
}

/**
 * Whole days an overdue NCR is past its target date; `0` when it is not overdue,
 * has no target date, or is already settled.
 *
 * @param ncr - The report to measure.
 * @returns The number of whole days late, never negative.
 */
export function ncrDaysOverdue(ncr: Ncr): number {
  if (!ncr.targetDate || SETTLED_NCR_STATUSES.has(ncr.status)) return 0;

  const due = parseLocalDate(ncr.targetDate);
  if (!due) return 0;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const days = Math.round(
    (startOfToday.getTime() - due.getTime()) / 86_400_000
  );
  return days > 0 ? days : 0;
}

/** A lifecycle transition, each of which is its own backend endpoint. */
export type NcrAction =
  | 'assign'
  | 'corrective-action-complete'
  | 'verify'
  | 'reject'
  | 'reopen'
  | 'close';

/** Human-readable label for each {@link NcrAction}, as a button caption. */
export const ncrActionLabels: Record<NcrAction, string> = {
  assign: 'Assign',
  'corrective-action-complete': 'Mark Corrected',
  verify: 'Verify',
  reject: 'Reject',
  reopen: 'Reopen',
  close: 'Close',
};

/**
 * The transitions available from a given state.
 *
 * Mirrors the backend's transition table, so the UI never offers a button whose
 * endpoint would reject the call. Rejected and reopened reports have to be
 * reassigned before corrective work can be reported again, which is why neither
 * offers `corrective-action-complete`.
 *
 * @param status - The state the report is in.
 * @returns The legal moves, in the order a UI should present them.
 */
export function availableNcrActions(status: NcrStatus): NcrAction[] {
  switch (status) {
    case NcrStatus.OPEN:
      return ['assign'];
    case NcrStatus.ASSIGNED:
      return ['corrective-action-complete', 'assign'];
    case NcrStatus.REJECTED:
    case NcrStatus.REOPENED:
      return ['assign'];
    case NcrStatus.CORRECTIVE_ACTION_COMPLETE:
      return ['verify', 'reject'];
    case NcrStatus.VERIFIED:
      return ['close', 'reopen'];
    case NcrStatus.CLOSED:
      return ['reopen'];
    default:
      return [];
  }
}
