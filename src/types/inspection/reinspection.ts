/**
 * @module types/inspection/reinspection
 *
 * One attempt at re-checking a non-conformance (backend `ReinspectionDto`),
 * served from `/ncrs/web/{ncrId}/reinspections` and
 * `/inspections/web/reinspections`.
 *
 * Scheduling a reinspection creates a fresh `Inspection` for the re-check,
 * cloned from the original with its failed check points reset, and this row
 * ties the two together with the NCR or defect that prompted it. Attempts are
 * numbered per NCR (or per defect): the first is `sequence` 1, a second
 * scheduled after a failure is 2, and so on, so the count of rows is the
 * number of times the work went back.
 *
 * The outcome is recorded explicitly through the outcome endpoint rather than
 * inferred from the reinspection inspection's check items. A `PASSED` outcome
 * is what an NCR verification can rest on: `verify` accepts the attempt's id
 * and takes the verifier and the time from the recorded outcome.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableString,
  optionalNumericId,
  opaque,
} from '../../lib/validation/backend-schema';

/**
 * What the re-check found. `PENDING` until the outcome is recorded; the
 * backend refuses a second outcome once one is set.
 */
export enum ReinspectionOutcome {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
}

/** Human-readable label for each {@link ReinspectionOutcome}. */
export const reinspectionOutcomeLabels: Record<ReinspectionOutcome, string> = {
  [ReinspectionOutcome.PENDING]: 'Pending',
  [ReinspectionOutcome.PASSED]: 'Passed',
  [ReinspectionOutcome.FAILED]: 'Failed',
};

/**
 * Narrows an untyped backend string to {@link ReinspectionOutcome}, defaulting
 * to `PENDING` when the value is absent or unrecognized. Pending is the state
 * an attempt starts in, so an unreadable one reads as still open rather than
 * as a pass the NCR could be verified against.
 */
export function parseReinspectionOutcome(raw: unknown): ReinspectionOutcome {
  return typeof raw === 'string' &&
    (Object.values(ReinspectionOutcome) as string[]).includes(raw)
    ? (raw as ReinspectionOutcome)
    : ReinspectionOutcome.PENDING;
}

const ReinspectionSchema = z.object({
  id: z.string().nullish(),
  projectId: optionalNumericId,
  ncrId: nullableString,
  defectId: nullableString,
  originalInspectionId: z.string().nullish(),
  reinspectionInspectionId: z.string().nullish(),
  sequence: z.coerce.number().int().nullish(),
  requestedById: optionalNumericId,
  requestedAt: backendDate,
  assignedInspectorId: optionalNumericId,
  targetDate: backendDate,
  outcome: opaque,
  outcomeById: optionalNumericId,
  outcomeAt: backendDate,
  remarks: nullableString,
  createdAt: backendDate,
  updatedAt: backendDate,
});

/** One reinspection attempt. */
export interface Reinspection {
  /** UUID primary key. */
  id: string;
  /** Project the originating inspection belongs to. */
  projectId?: number;
  /** The NCR being re-checked, when the attempt came from an NCR. */
  ncrId?: string;
  /** The defect being re-checked, when the attempt came from a defect. */
  defectId?: string;
  /** The inspection that found the non-conformance. */
  originalInspectionId: string;
  /** The new inspection created for the re-check. One inspection per attempt. */
  reinspectionInspectionId: string;
  /** 1 for the first attempt on this NCR or defect, 2 for the next, and so on. */
  sequence: number;
  /** Employee who scheduled the re-check. */
  requestedById?: number;
  /** When it was scheduled (ISO string). */
  requestedAt?: string;
  /** Inspector the re-check is assigned to. */
  assignedInspectorId?: number;
  /** Date the re-check is due (`YYYY-MM-DD`). */
  targetDate?: string;
  /** What the re-check found. */
  outcome: ReinspectionOutcome;
  /** Employee who recorded the outcome. */
  outcomeById?: number;
  /** When the outcome was recorded (ISO string). */
  outcomeAt?: string;
  /** What was seen on the re-check. */
  remarks?: string;
  /** Creation timestamp (ISO string). */
  createdAt?: string;
  /** Last-update timestamp (ISO string). */
  updatedAt?: string;
}

/**
 * Parses a raw reinspection payload into a typed {@link Reinspection}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Reinspection`.
 * @throws {TypeError} If `id`, `originalInspectionId` or
 *   `reinspectionInspectionId` is missing or not a non-empty string.
 */
export function parseReinspection(json: unknown): Reinspection {
  const raw = ReinspectionSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseReinspection.id'),
    projectId: raw.projectId ?? undefined,
    ncrId: raw.ncrId ?? undefined,
    defectId: raw.defectId ?? undefined,
    originalInspectionId: parseUuid(
      raw.originalInspectionId,
      'parseReinspection.originalInspectionId'
    ),
    reinspectionInspectionId: parseUuid(
      raw.reinspectionInspectionId,
      'parseReinspection.reinspectionInspectionId'
    ),
    sequence: raw.sequence ?? 1,
    requestedById: raw.requestedById ?? undefined,
    requestedAt: raw.requestedAt ?? undefined,
    assignedInspectorId: raw.assignedInspectorId ?? undefined,
    targetDate: raw.targetDate ?? undefined,
    outcome: parseReinspectionOutcome(raw.outcome),
    outcomeById: raw.outcomeById ?? undefined,
    outcomeAt: raw.outcomeAt ?? undefined,
    remarks: raw.remarks ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

/**
 * Fields for scheduling a reinspection. Everything is optional: the backend
 * clones the original inspection, numbers the attempt and records the
 * requester from the session.
 */
export interface ScheduleReinspectionRequest {
  /** Inspector who carries out the re-check. */
  assignedInspectorId?: number;
  /** Date the re-check is due (`YYYY-MM-DD`); becomes the new inspection's scheduled date. */
  targetDate?: string;
  /**
   * Copy every check point of the original rather than only the failed ones.
   * Defaults to `false` on the server.
   */
  copyAllItems?: boolean;
}

/** Records what a reinspection found. */
export interface ReinspectionOutcomeRequest {
  /** `PASSED` when the work now conforms, `FAILED` otherwise. Required. */
  outcome: ReinspectionOutcome;
  /** What was seen on the re-check (max 2000). */
  remarks?: string;
}

/**
 * Serializes a {@link ScheduleReinspectionRequest} into the backend request
 * body. Always returns an object, so scheduling with no options still sends a
 * valid body.
 *
 * @param dto - The request to serialize, or nothing.
 * @returns A plain object matching the backend `ScheduleReinspectionRequest`.
 */
export function scheduleReinspectionToJson(
  dto?: ScheduleReinspectionRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (dto?.assignedInspectorId !== undefined)
    json.assignedInspectorId = dto.assignedInspectorId;
  if (dto?.targetDate !== undefined) json.targetDate = dto.targetDate;
  if (dto?.copyAllItems !== undefined) json.copyAllItems = dto.copyAllItems;
  return json;
}

/**
 * Serializes a {@link ReinspectionOutcomeRequest} into the backend request
 * body.
 *
 * @param dto - The outcome to serialize.
 * @returns A plain object matching the backend `ReinspectionOutcomeRequest`.
 */
export function reinspectionOutcomeToJson(
  dto: ReinspectionOutcomeRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = { outcome: dto.outcome };
  if (dto.remarks !== undefined) json.remarks = dto.remarks;
  return json;
}

/**
 * The attempts a verification may rest on: those that passed. The most recent
 * comes first, which is the one a verify dialog should offer by default.
 *
 * @param attempts - Every attempt on the NCR or defect.
 * @returns The passed attempts, highest sequence first.
 */
export function passedReinspections(attempts: Reinspection[]): Reinspection[] {
  return attempts
    .filter((attempt) => attempt.outcome === ReinspectionOutcome.PASSED)
    .sort((a, b) => b.sequence - a.sequence);
}

/**
 * Whether an attempt is still awaiting its outcome. A UI uses this to hold
 * back "schedule another" while one re-check is unresolved: a second attempt
 * belongs after a failure, and scheduling it before the first is decided
 * would leave two open inspections for one non-conformance.
 *
 * @param attempts - Every attempt on the NCR or defect.
 * @returns `true` when at least one attempt has no outcome yet.
 */
export function hasPendingReinspection(attempts: Reinspection[]): boolean {
  return attempts.some(
    (attempt) => attempt.outcome === ReinspectionOutcome.PENDING
  );
}
