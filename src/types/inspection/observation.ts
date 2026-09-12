/**
 * @module types/inspection/observation
 *
 * A finding on site as recorded by a person, a model or a device (backend
 * `ObservationDto`), served from `/inspections/web/observations`.
 *
 * The source is metadata: a human inspector, the compliance model, a drone,
 * a ground robot and a fixed camera all produce the same row, and only the
 * metadata columns that are filled differ. What makes an observation useful
 * is that it has a persistent id before anyone has decided what it is, so
 * the evidence, the review decision and the record it turns into (a check
 * item result, a defect, an NCR, a whole inspection) all hang off one thing.
 *
 * Machine intake lands `PENDING`; a person then accepts, modifies or rejects
 * it. A human observation is created `ACCEPTED` on the spot, the creator's
 * act being the decision. There is no auto-accept path by confidence.
 *
 * The machine intake endpoint (`POST /observations/intake`) is for service
 * accounts and is deliberately not wrapped here: the console never calls it.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableNumber,
  nullableString,
  optionalNumericId,
  opaque,
} from '../../lib/validation/backend-schema';
import {
  SpatialPathSegment,
  parseSpatialPathSegment,
} from '../spatial/spatial';
import {
  CheckItemStatus,
  DefectSeverity,
  InspectionDefectRequest,
  inspectionDefectRequestToJson,
  parseDefectSeverity,
} from './inspection';

/** Who or what saw it. */
export enum ObservationSource {
  HUMAN = 'human',
  AI = 'ai',
  DRONE = 'drone',
  ROBOT = 'robot',
  FIXED_CAMERA = 'fixed-camera',
}

/** Human-readable label for each {@link ObservationSource}. */
export const observationSourceLabels: Record<ObservationSource, string> = {
  [ObservationSource.HUMAN]: 'Human',
  [ObservationSource.AI]: 'AI',
  [ObservationSource.DRONE]: 'Drone',
  [ObservationSource.ROBOT]: 'Robot',
  [ObservationSource.FIXED_CAMERA]: 'Fixed camera',
};

/**
 * Where the human decision stands. `PENDING` until someone reviews;
 * `MODIFIED` means there is a finding but the reviewer changed something,
 * with the edits kept in {@link Observation.reviewChanges}.
 */
export enum ObservationReviewStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  MODIFIED = 'modified',
}

/** Human-readable label for each {@link ObservationReviewStatus}. */
export const observationReviewStatusLabels: Record<
  ObservationReviewStatus,
  string
> = {
  [ObservationReviewStatus.PENDING]: 'Pending',
  [ObservationReviewStatus.ACCEPTED]: 'Accepted',
  [ObservationReviewStatus.REJECTED]: 'Rejected',
  [ObservationReviewStatus.MODIFIED]: 'Modified',
};

/**
 * What the observation became. `NCR` is only ever set by the backend, when
 * an NCR raised through its own endpoint links the observation it came from;
 * a review naming it is refused with 400.
 */
export enum ObservationOutcomeKind {
  NONE = 'none',
  CHECK_ITEM = 'check-item',
  DEFECT = 'defect',
  NCR = 'ncr',
  INSPECTION = 'inspection',
}

/** Human-readable label for each {@link ObservationOutcomeKind}. */
export const observationOutcomeKindLabels: Record<
  ObservationOutcomeKind,
  string
> = {
  [ObservationOutcomeKind.NONE]: 'No action',
  [ObservationOutcomeKind.CHECK_ITEM]: 'Check item',
  [ObservationOutcomeKind.DEFECT]: 'Defect',
  [ObservationOutcomeKind.NCR]: 'NCR',
  [ObservationOutcomeKind.INSPECTION]: 'Inspection',
};

/** The three decisions a reviewer can take on a pending observation. */
export enum ObservationDecision {
  ACCEPT = 'accept',
  REJECT = 'reject',
  MODIFY = 'modify',
}

function narrow<T extends string>(
  values: readonly T[],
  raw: unknown,
  fallback: T
): T {
  return typeof raw === 'string' && (values as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

/**
 * Narrows an untyped backend string to {@link ObservationSource}. An
 * unreadable source reads as `HUMAN`: it is the only source with no model
 * or device metadata, so nothing in the UI is shown that was not there.
 */
export function parseObservationSource(raw: unknown): ObservationSource {
  return narrow(Object.values(ObservationSource), raw, ObservationSource.HUMAN);
}

/**
 * Narrows an untyped backend string to {@link ObservationReviewStatus},
 * defaulting to `PENDING`. Pending is where every machine observation starts
 * and the only state that offers a decision, so an unreadable one is shown
 * as still open rather than as accepted.
 */
export function parseObservationReviewStatus(
  raw: unknown
): ObservationReviewStatus {
  return narrow(
    Object.values(ObservationReviewStatus),
    raw,
    ObservationReviewStatus.PENDING
  );
}

/**
 * Narrows an untyped backend string to {@link ObservationOutcomeKind},
 * defaulting to `NONE`.
 */
export function parseObservationOutcomeKind(
  raw: unknown
): ObservationOutcomeKind {
  return narrow(
    Object.values(ObservationOutcomeKind),
    raw,
    ObservationOutcomeKind.NONE
  );
}

/**
 * One field the reviewer changed on a `MODIFIED` observation. `before` is
 * what the producer wrote; `after` is what the reviewer decided.
 */
export interface ObservationReviewChange {
  field: string;
  before?: unknown;
  after?: unknown;
}

/**
 * A pointer to evidence in the producer's own shape. Evidence uploaded into
 * Echno is cited as `{ attachmentId }`; captures that live in the robot data
 * layer carry whatever keys the producer uses (frame index, point-cloud id,
 * crop bounds).
 */
export type ObservationEvidenceRef = Record<string, unknown> & {
  attachmentId?: number;
};

const ObservationEvidenceRefSchema = z
  .object({ attachmentId: z.coerce.number().int().positive().optional() })
  .catchall(z.unknown());

const ObservationSchema = z.object({
  id: z.string().nullish(),
  projectId: optionalNumericId,
  inspectionId: nullableString,
  spatialNodeId: nullableString,
  spatialPath: z.array(z.unknown()).nullish(),
  locationNote: nullableString,
  source: opaque,
  sourceDeviceId: nullableString,
  missionRef: nullableString,
  captureRef: nullableString,
  externalRef: nullableString,
  modelName: nullableString,
  modelVersion: nullableString,
  confidence: nullableNumber,
  observedAt: backendDate,
  reportedById: optionalNumericId,
  title: nullableString,
  description: nullableString,
  category: nullableString,
  suggestedSeverity: opaque,
  evidenceRefs: z.array(ObservationEvidenceRefSchema).nullish(),
  reviewStatus: opaque,
  reviewedById: optionalNumericId,
  reviewedAt: backendDate,
  reviewNote: nullableString,
  reviewChanges: z.array(z.record(z.string(), z.unknown())).nullish(),
  outcomeKind: opaque,
  outcomeRef: nullableString,
  createdAt: backendDate,
  updatedAt: backendDate,
});

/** A finding on site with its review decision and the record it produced. */
export interface Observation {
  /** UUID primary key. */
  id: string;
  /** Project the finding belongs to. */
  projectId?: number;
  /** Inspection it is filed under. Unset for a finding recorded before any inspection existed for it. */
  inspectionId?: string;
  /** Site structure node, or unset where only the free-text location was given. */
  spatialNodeId?: string;
  /** Ordered ancestors from the building down to `spatialNodeId`. Empty when unset. */
  spatialPath: SpatialPathSegment[];
  /** Free-text location, the fallback when the tree has no node for the place. */
  locationNote?: string;
  /** Who or what saw it. */
  source: ObservationSource;
  /** The device or integration that produced it, named by the producer. */
  sourceDeviceId?: string;
  /** The run (flight, patrol) it came from. */
  missionRef?: string;
  /** Pointer into the robot data layer's capture record. */
  captureRef?: string;
  /** The producer's own id for the finding; unique per organisation. */
  externalRef?: string;
  /** Model that produced it, for an AI-derived finding. */
  modelName?: string;
  /** Version of that model. */
  modelVersion?: string;
  /** Model confidence in `[0, 1]`. Unset for a human observation or a model that gives none. */
  confidence?: number;
  /** When it was seen (ISO string). */
  observedAt?: string;
  /** Employee who saw it, for a human observation. */
  reportedById?: number;
  /** Short name of the finding. */
  title: string;
  /** What was seen. For a compliance suggestion, the model's rationale. */
  description?: string;
  /** Free-text category. */
  category?: string;
  /** Severity the producer proposed. */
  suggestedSeverity?: DefectSeverity;
  /** Pointers to evidence, in the producer's own shape. */
  evidenceRefs: ObservationEvidenceRef[];
  /** Where the human decision stands. */
  reviewStatus: ObservationReviewStatus;
  /** Employee who decided. */
  reviewedById?: number;
  /** When the decision was recorded (ISO string). */
  reviewedAt?: string;
  /** Reviewer's note. Always present on a rejection. */
  reviewNote?: string;
  /** The reviewer's edits, one entry per field. Only on a `MODIFIED` observation. */
  reviewChanges: ObservationReviewChange[];
  /** What the observation became. */
  outcomeKind: ObservationOutcomeKind;
  /** Id of the check item, defect, NCR or inspection it produced, according to `outcomeKind`. */
  outcomeRef?: string;
  /** Creation timestamp (ISO string). */
  createdAt?: string;
  /** Last-update timestamp (ISO string). */
  updatedAt?: string;
}

function parseReviewChange(raw: Record<string, unknown>): ObservationReviewChange {
  return {
    field: typeof raw.field === 'string' ? raw.field : '',
    before: raw.before,
    after: raw.after,
  };
}

/**
 * Parses a raw observation payload into a typed {@link Observation}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Observation`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseObservation(json: unknown): Observation {
  const raw = ObservationSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseObservation.id'),
    projectId: raw.projectId ?? undefined,
    inspectionId: raw.inspectionId ?? undefined,
    spatialNodeId: raw.spatialNodeId ?? undefined,
    spatialPath: (raw.spatialPath ?? []).map((segment) =>
      parseSpatialPathSegment(segment)
    ),
    locationNote: raw.locationNote ?? undefined,
    source: parseObservationSource(raw.source),
    sourceDeviceId: raw.sourceDeviceId ?? undefined,
    missionRef: raw.missionRef ?? undefined,
    captureRef: raw.captureRef ?? undefined,
    externalRef: raw.externalRef ?? undefined,
    modelName: raw.modelName ?? undefined,
    modelVersion: raw.modelVersion ?? undefined,
    confidence: raw.confidence ?? undefined,
    observedAt: raw.observedAt ?? undefined,
    reportedById: raw.reportedById ?? undefined,
    title: raw.title ?? '',
    description: raw.description ?? undefined,
    category: raw.category ?? undefined,
    suggestedSeverity:
      raw.suggestedSeverity == null
        ? undefined
        : parseDefectSeverity(raw.suggestedSeverity),
    evidenceRefs: raw.evidenceRefs ?? [],
    reviewStatus: parseObservationReviewStatus(raw.reviewStatus),
    reviewedById: raw.reviewedById ?? undefined,
    reviewedAt: raw.reviewedAt ?? undefined,
    reviewNote: raw.reviewNote ?? undefined,
    reviewChanges: (raw.reviewChanges ?? []).map(parseReviewChange),
    outcomeKind: parseObservationOutcomeKind(raw.outcomeKind),
    outcomeRef: raw.outcomeRef ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

/**
 * The attachment ids an observation cites as evidence, read off its
 * `evidenceRefs`. Refs that point outside the Echno store are skipped.
 *
 * @param observation - The observation.
 * @returns Attachment ids, in the order the refs were recorded.
 */
export function observationAttachmentIds(observation: Observation): number[] {
  return observation.evidenceRefs
    .map((ref) => ref.attachmentId)
    .filter((id): id is number => typeof id === 'number');
}

/**
 * Whether a reviewer can still decide on the observation. Only a pending one
 * takes a decision; the backend refuses a second one with 409.
 *
 * @param observation - The observation.
 * @returns `true` while `reviewStatus` is `PENDING`.
 */
export function isObservationPending(observation: Observation): boolean {
  return observation.reviewStatus === ObservationReviewStatus.PENDING;
}

/**
 * Fields for a human observation. The signed-in inspector is the reporter
 * and the reviewer: the row is created `ACCEPTED`.
 */
export interface CreateObservationRequest {
  /** Project the finding belongs to. Required. */
  projectId: number;
  /** Inspection to file it under, when there is one. */
  inspectionId?: string;
  /** Site structure node. Optional; `locationNote` is the free-text fallback. */
  spatialNodeId?: string;
  /** Free-text location (max 300). */
  locationNote?: string;
  /** When it was seen (ISO string). Defaults to now on the server. */
  observedAt?: string;
  /** Short name of the finding (max 200). Required. */
  title: string;
  /** What was seen (max 4000). */
  description?: string;
  /** Free-text category (max 200). */
  category?: string;
  /** Severity the inspector proposes. */
  suggestedSeverity?: DefectSeverity;
  /**
   * Ids of attachments already in the Echno store to cite as evidence. Each
   * becomes an `{ attachmentId }` entry in `evidenceRefs`.
   */
  evidenceAttachmentIds?: number[];
}

/**
 * Serializes a {@link CreateObservationRequest} into the backend request
 * body. Required fields are always written; optional ones only when set.
 *
 * @param dto - The request to serialize.
 * @returns A plain object matching the backend `CreateObservationRequest`.
 */
export function createObservationToJson(
  dto: CreateObservationRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    projectId: dto.projectId,
    title: dto.title,
  };
  if (dto.inspectionId !== undefined) json.inspectionId = dto.inspectionId;
  if (dto.spatialNodeId !== undefined) json.spatialNodeId = dto.spatialNodeId;
  if (dto.locationNote !== undefined) json.locationNote = dto.locationNote;
  if (dto.observedAt !== undefined) json.observedAt = dto.observedAt;
  if (dto.description !== undefined) json.description = dto.description;
  if (dto.category !== undefined) json.category = dto.category;
  if (dto.suggestedSeverity !== undefined)
    json.suggestedSeverity = dto.suggestedSeverity;
  if (dto.evidenceAttachmentIds !== undefined)
    json.evidenceAttachmentIds = dto.evidenceAttachmentIds;
  return json;
}

/**
 * The reviewer's edits on a `MODIFY` decision. Only the fields set are
 * compared to the proposal; the diff the backend stores is what differs.
 */
export interface ObservationReviewChanges {
  title?: string;
  description?: string;
  severity?: DefectSeverity;
  spatialNodeId?: string;
  category?: string;
}

/**
 * What an accepted or modified observation becomes. `kind` decides which
 * other fields are read: `CHECK_ITEM` reads `checkItemId` and `status`;
 * `DEFECT` reads `defectId` (attach to an existing defect) or `defect`
 * (create one, which needs the observation to be on an inspection);
 * `INSPECTION` reads `inspectionId`. `NCR` cannot be chosen here.
 */
export type ObservationOutcomeRequest =
  | { kind: ObservationOutcomeKind.NONE }
  | {
      kind: ObservationOutcomeKind.CHECK_ITEM;
      checkItemId: string;
      status: CheckItemStatus;
    }
  | { kind: ObservationOutcomeKind.DEFECT; defectId: string; defect?: never }
  | {
      kind: ObservationOutcomeKind.DEFECT;
      defect: InspectionDefectRequest;
      defectId?: never;
    }
  | { kind: ObservationOutcomeKind.INSPECTION; inspectionId: string };

/**
 * The human decision on a pending observation. One decision per observation;
 * the backend answers 409 to a second. `note` is required on `REJECT`, and
 * `changes` must carry at least one field on `MODIFY`. `outcome` is ignored
 * on `REJECT` and defaults to `NONE` otherwise.
 */
export interface ReviewObservationRequest {
  decision: ObservationDecision;
  note?: string;
  changes?: ObservationReviewChanges;
  outcome?: ObservationOutcomeRequest;
}

function reviewChangesToJson(
  changes: ObservationReviewChanges
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (changes.title !== undefined) json.title = changes.title;
  if (changes.description !== undefined) json.description = changes.description;
  if (changes.severity !== undefined) json.severity = changes.severity;
  if (changes.spatialNodeId !== undefined)
    json.spatialNodeId = changes.spatialNodeId;
  if (changes.category !== undefined) json.category = changes.category;
  return json;
}

function outcomeToJson(
  outcome: ObservationOutcomeRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = { kind: outcome.kind };
  if ('checkItemId' in outcome) {
    json.checkItemId = outcome.checkItemId;
    json.status = outcome.status;
  }
  if ('defectId' in outcome && outcome.defectId !== undefined)
    json.defectId = outcome.defectId;
  if ('defect' in outcome && outcome.defect !== undefined)
    json.defect = inspectionDefectRequestToJson(outcome.defect);
  if ('inspectionId' in outcome) json.inspectionId = outcome.inspectionId;
  return json;
}

/**
 * Whether a {@link ObservationReviewChanges} carries at least one edit.
 * A `MODIFY` with none is refused by the backend, so a form should hold the
 * submit until this is true.
 */
export function hasObservationChanges(
  changes?: ObservationReviewChanges
): boolean {
  return (
    !!changes && Object.values(changes).some((value) => value !== undefined)
  );
}

/**
 * Serializes a {@link ReviewObservationRequest} into the backend request
 * body.
 *
 * The two server-side rules are checked here first so a form gets a plain
 * error before the round trip: a rejection with no note, and a modification
 * with no change, both throw.
 *
 * @param dto - The decision to serialize.
 * @returns A plain object matching the backend `ReviewObservationRequest`.
 * @throws {TypeError} On `REJECT` without a note, or `MODIFY` without a change.
 */
export function reviewObservationToJson(
  dto: ReviewObservationRequest
): Record<string, unknown> {
  if (dto.decision === ObservationDecision.REJECT && !dto.note?.trim()) {
    throw new TypeError('A rejection needs a note saying why.');
  }
  if (
    dto.decision === ObservationDecision.MODIFY &&
    !hasObservationChanges(dto.changes)
  ) {
    throw new TypeError('A modification needs at least one changed field.');
  }
  const json: Record<string, unknown> = { decision: dto.decision };
  if (dto.note !== undefined) json.note = dto.note;
  if (dto.changes !== undefined) json.changes = reviewChangesToJson(dto.changes);
  if (dto.decision !== ObservationDecision.REJECT && dto.outcome !== undefined)
    json.outcome = outcomeToJson(dto.outcome);
  return json;
}
