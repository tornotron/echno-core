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
import { logger } from '../../lib/logger';
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

/**
 * The geometry of an observation region. A polygon also carries its bounding
 * box, so filtering, cropping and the grid tile read the same four numbers
 * for both shapes.
 */
export enum RegionShape {
  BOX = 'box',
  POLYGON = 'polygon',
}

/**
 * Who drew a region: the producer that posted the observation, a reviewer
 * correcting it during a `MODIFY`, or the person who recorded a human
 * observation.
 */
export enum RegionOrigin {
  PRODUCER = 'producer',
  REVIEWER = 'reviewer',
  HUMAN = 'human',
}

/** Human-readable label for each {@link RegionOrigin}. */
export const regionOriginLabels: Record<RegionOrigin, string> = {
  [RegionOrigin.PRODUCER]: 'Model',
  [RegionOrigin.REVIEWER]: 'Reviewer',
  [RegionOrigin.HUMAN]: 'Inspector',
};

/**
 * Why a reviewer rejected an observation. Only `FALSE_POSITIVE` makes the
 * rejected regions negative training examples; the other reasons keep them
 * out of the training signal. Required on a rejection when the observation
 * has regions from its producer.
 */
export enum RejectReason {
  FALSE_POSITIVE = 'false-positive',
  DUPLICATE = 'duplicate',
  OUT_OF_SCOPE = 'out-of-scope',
  POOR_IMAGE = 'poor-image',
}

/** Human-readable label for each {@link RejectReason}. */
export const rejectReasonLabels: Record<RejectReason, string> = {
  [RejectReason.FALSE_POSITIVE]: 'False positive',
  [RejectReason.DUPLICATE]: 'Duplicate',
  [RejectReason.OUT_OF_SCOPE]: 'Out of scope',
  [RejectReason.POOR_IMAGE]: 'Poor image',
};

/** The three operations a reviewer can apply to an observation's regions. */
export enum RegionEditKind {
  REPLACE = 'replace',
  REMOVE = 'remove',
  ADD = 'add',
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
 * Narrows an untyped backend string to {@link RegionShape}, defaulting to
 * `BOX`. Both shapes carry a bounding box, so a box is always drawable.
 * The backend writes the slug; the constant name (`POLYGON`, as the model
 * registry writes a class's shape) is read too.
 */
export function parseRegionShape(raw: unknown): RegionShape {
  return narrow(
    Object.values(RegionShape),
    typeof raw === 'string' ? raw.toLowerCase() : raw,
    RegionShape.BOX
  );
}

/**
 * Narrows an untyped backend string to {@link RegionOrigin}, defaulting to
 * `PRODUCER`: a region nobody can be named for is shown as unreviewed
 * machine output, never as a person's correction.
 */
export function parseRegionOrigin(raw: unknown): RegionOrigin {
  return narrow(Object.values(RegionOrigin), raw, RegionOrigin.PRODUCER);
}

/**
 * Narrows an untyped backend string to {@link RejectReason}, or `undefined`
 * when it is absent or unreadable. An unknown reason is left unset rather
 * than guessed, because only one of the reasons feeds training.
 */
export function parseRejectReason(raw: unknown): RejectReason | undefined {
  return typeof raw === 'string' &&
    (Object.values(RejectReason) as string[]).includes(raw)
    ? (raw as RejectReason)
    : undefined;
}

/**
 * A bounding box as fractions of the image, `[x1, y1, x2, y2]`, origin top
 * left, x to the right, y down, measured on the image as displayed (after
 * EXIF orientation). `x1 < x2` and `y1 < y2`.
 */
export type RegionBox = [number, number, number, number];

/** One polygon vertex as fractions of the image, `[x, y]`. */
export type RegionPoint = [number, number];

/**
 * A box or polygon on one image, with a class and, for a model's region, a
 * score (backend `ObservationRegionDto`). Coordinates are fractions in
 * `[0, 1]`, so an SVG with `viewBox="0 0 1 1"` over the image draws them
 * without conversion.
 *
 * A reviewer's correction is a new region that supersedes the producer's;
 * the producer's region is retired, never edited. Retired regions come back
 * only from the single read with `includeRetiredRegions`.
 */
export interface ObservationRegion {
  /** UUID primary key. */
  id: string;
  /** The image the region is drawn on. */
  attachmentId: number;
  /** Box or polygon. */
  shape: RegionShape;
  /** The bounding box; for a polygon, the box around its vertices. */
  box: RegionBox;
  /** `POLYGON` only: the open vertex list (the first vertex is not repeated). */
  points?: RegionPoint[];
  /** Pixel width of the image as displayed, when the producer knew it. */
  imageWidth?: number;
  /** Pixel height of the image as displayed, when the producer knew it. */
  imageHeight?: number;
  /** Class key from the class taxonomy, e.g. `ppe_helmet`. */
  classKey: string;
  /** Producer score in `[0, 1]`. Unset for a region a person drew. */
  score?: number;
  /** Who drew it. */
  origin: RegionOrigin;
  /** The region this one corrects. */
  supersedesId?: string;
  /** When a review replaced or removed it (ISO string). Unset while active. */
  retiredAt?: string;
  /** Employee whose review retired it. */
  retiredById?: number;
  /** Draw order within the observation. */
  lineOrder: number;
  /** Creation timestamp (ISO string). */
  createdAt?: string;
  /** Employee who drew it; unset for a producer's region. */
  createdById?: number;
}

/** A number, or the string form of one (a `BigDecimal` may arrive either way). */
const coordinate = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  z.number().finite()
);

const ObservationRegionSchema = z.object({
  id: z.string().nullish(),
  attachmentId: optionalNumericId,
  shape: opaque,
  box: z.array(coordinate).length(4),
  points: z.array(z.array(coordinate).length(2)).nullish(),
  imageWidth: optionalNumericId,
  imageHeight: optionalNumericId,
  classKey: nullableString,
  score: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
    z.number().finite().nullish()
  ),
  origin: opaque,
  supersedesId: nullableString,
  retiredAt: backendDate,
  retiredById: optionalNumericId,
  lineOrder: z.number().int().nullish(),
  createdAt: backendDate,
  createdById: optionalNumericId,
});

/**
 * Parses a raw region payload into a typed {@link ObservationRegion}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `ObservationRegion`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 * @throws {z.ZodError} If `attachmentId` is missing or `box` is not four numbers.
 */
export function parseObservationRegion(json: unknown): ObservationRegion {
  const raw = ObservationRegionSchema.parse(json);
  if (raw.attachmentId == null) {
    throw new TypeError('parseObservationRegion.attachmentId is required');
  }
  const shape = parseRegionShape(raw.shape);
  return {
    id: parseUuid(raw.id, 'parseObservationRegion.id'),
    attachmentId: raw.attachmentId,
    shape,
    box: raw.box as RegionBox,
    points:
      shape === RegionShape.POLYGON && raw.points
        ? raw.points.map((point) => point as RegionPoint)
        : undefined,
    imageWidth: raw.imageWidth ?? undefined,
    imageHeight: raw.imageHeight ?? undefined,
    classKey: raw.classKey ?? '',
    score: raw.score ?? undefined,
    origin: parseRegionOrigin(raw.origin),
    supersedesId: raw.supersedesId ?? undefined,
    retiredAt: raw.retiredAt ?? undefined,
    retiredById: raw.retiredById ?? undefined,
    lineOrder: raw.lineOrder ?? 0,
    createdAt: raw.createdAt ?? undefined,
    createdById: raw.createdById ?? undefined,
  };
}

/**
 * Parses the regions on an observation. A region that cannot be drawn (no
 * id, no image, a box that is not four numbers) is dropped with a warning
 * instead of failing the whole observation: the finding is still readable
 * and reviewable without it.
 */
function parseRegionList(raw: unknown[] | null | undefined): ObservationRegion[] {
  const regions: ObservationRegion[] = [];
  for (const item of raw ?? []) {
    try {
      regions.push(parseObservationRegion(item));
    } catch (error) {
      logger.warn('Dropped an unreadable observation region', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return regions;
}

/**
 * Whether a region is still in force: not replaced or removed by a review.
 *
 * @param region - The region.
 * @returns `true` while `retiredAt` is unset.
 */
export function isRegionActive(region: ObservationRegion): boolean {
  return region.retiredAt === undefined;
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

/**
 * `attachmentId` only when the producer sent a positive integer (or its
 * string form). Anything else (`null`, a frame label, 0) is a ref outside
 * the Echno store and is left in place without an attachment id, instead
 * of failing the whole observation.
 */
function positiveIntegerOrUndefined(value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

const ObservationEvidenceRefSchema = z
  .object({ attachmentId: z.preprocess(positiveIntegerOrUndefined, z.number().optional()) })
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
  regions: z.array(z.unknown()).nullish(),
  reviewStatus: opaque,
  reviewedById: optionalNumericId,
  reviewedAt: backendDate,
  reviewNote: nullableString,
  reviewChanges: z.array(z.record(z.string(), z.unknown())).nullish(),
  rejectReason: opaque,
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
  /**
   * Boxes and polygons on the evidence images, in draw order. Active regions
   * only, unless the observation was read with `includeRetiredRegions`.
   * Empty when the backend sent none.
   */
  regions: ObservationRegion[];
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
  /** Why it was rejected. Only on a `REJECTED` observation, and not always then. */
  rejectReason?: RejectReason;
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
    regions: parseRegionList(raw.regions),
    reviewStatus: parseObservationReviewStatus(raw.reviewStatus),
    reviewedById: raw.reviewedById ?? undefined,
    reviewedAt: raw.reviewedAt ?? undefined,
    reviewNote: raw.reviewNote ?? undefined,
    reviewChanges: (raw.reviewChanges ?? []).map(parseReviewChange),
    rejectReason: parseRejectReason(raw.rejectReason),
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
 * The shape of a region a person draws or corrects: a box, or a polygon of
 * 3 to 200 open vertices (the backend computes a polygon's bounding box).
 * Coordinates are fractions in `[0, 1]`; the backend rounds them to 6 places
 * and refuses an inverted box or a self-intersecting polygon with 400.
 */
export type RegionGeometry =
  | { shape: RegionShape.BOX; box: RegionBox; points?: never }
  | { shape: RegionShape.POLYGON; points: RegionPoint[]; box?: never };

/**
 * A region an inspector draws on a human observation (backend
 * `ObservationRegionRequest`). Stored with origin `HUMAN` and no score.
 */
export type ObservationRegionRequest = RegionGeometry & {
  /** The image, already in the Echno store, that the region is drawn on. */
  attachmentId: number;
  /** Class key from the class taxonomy (max 50). */
  classKey: string;
  /** Pixel width of the image as displayed, when known. */
  imageWidth?: number;
  /** Pixel height of the image as displayed, when known. */
  imageHeight?: number;
};

function geometryToJson(geometry: RegionGeometry): Record<string, unknown> {
  return geometry.shape === RegionShape.POLYGON
    ? { shape: geometry.shape, points: geometry.points }
    : { shape: geometry.shape, box: geometry.box };
}

/**
 * Serializes an {@link ObservationRegionRequest} into the backend body.
 *
 * @param region - The region to serialize.
 * @returns A plain object matching the backend `ObservationRegionRequest`.
 */
export function observationRegionRequestToJson(
  region: ObservationRegionRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    attachmentId: region.attachmentId,
    ...geometryToJson(region),
    classKey: region.classKey,
  };
  if (region.imageWidth !== undefined) json.imageWidth = region.imageWidth;
  if (region.imageHeight !== undefined) json.imageHeight = region.imageHeight;
  return json;
}

/**
 * One reviewer operation on an observation's regions during a `MODIFY`
 * (backend `RegionEditOp`), applied in order. Nothing is edited in place:
 *
 * - `REPLACE` retires the named region and inserts the correction, with the
 *   same shape on the same image. A class change is a replace with another
 *   `classKey` (a taxonomy class of the same shape).
 * - `REMOVE` retires the named region and inserts nothing.
 * - `ADD` draws a region the producer missed, on an image the observation
 *   already cites.
 *
 * A modification that would leave no active region on an observation that
 * had producer regions is refused with 400: reject it instead.
 */
export type RegionEditOp =
  | (RegionGeometry & {
      op: RegionEditKind.REPLACE;
      /** The active region to replace. */
      regionId: string;
      classKey: string;
    })
  | {
      op: RegionEditKind.REMOVE;
      /** The active region to retire. */
      regionId: string;
    }
  | (RegionGeometry & {
      op: RegionEditKind.ADD;
      /** The image to draw on. */
      attachmentId: number;
      classKey: string;
      /** Pixel width of the image as displayed, when known. */
      imageWidth?: number;
      /** Pixel height of the image as displayed, when known. */
      imageHeight?: number;
    });

/**
 * Serializes one {@link RegionEditOp} into the backend body.
 *
 * @param op - The operation.
 * @returns A plain object matching the backend `RegionEditOp`.
 */
export function regionEditOpToJson(op: RegionEditOp): Record<string, unknown> {
  switch (op.op) {
    case RegionEditKind.REMOVE:
      return { op: op.op, regionId: op.regionId };
    case RegionEditKind.REPLACE:
      return {
        op: op.op,
        regionId: op.regionId,
        ...geometryToJson(op),
        classKey: op.classKey,
      };
    case RegionEditKind.ADD: {
      const json: Record<string, unknown> = {
        op: op.op,
        attachmentId: op.attachmentId,
        ...geometryToJson(op),
        classKey: op.classKey,
      };
      if (op.imageWidth !== undefined) json.imageWidth = op.imageWidth;
      if (op.imageHeight !== undefined) json.imageHeight = op.imageHeight;
      return json;
    }
  }
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
  /**
   * Site structure node. `undefined` leaves the field out of the request and
   * `null` sends an explicit "no node" (the backend accepts both and stores
   * no node either way); `locationNote` is the free-text fallback.
   */
  spatialNodeId?: string | null;
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
  /** Regions the inspector drew, up to 20. Stored with origin `HUMAN`. */
  regions?: ObservationRegionRequest[];
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
  if (dto.regions !== undefined)
    json.regions = dto.regions.map(observationRegionRequestToJson);
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
  /**
   * A review can move the observation to another node but cannot clear it:
   * the backend's `Changes` carries a node id only, so `undefined` here means
   * "unchanged" and a form that lets the reviewer clear the picker must drop
   * the field rather than send it.
   */
  spatialNodeId?: string;
  category?: string;
  /**
   * Edits to the regions, applied in order (max 50). An empty list is no
   * change. See {@link RegionEditOp}.
   */
  regions?: RegionEditOp[];
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
  /**
   * `REJECT` only, and sent only then. Required by the backend (400 without
   * it) when the observation has regions from its producer; optional
   * otherwise. Only `FALSE_POSITIVE` turns the regions into training
   * negatives.
   */
  rejectReason?: RejectReason;
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
  if (changes.regions !== undefined && changes.regions.length > 0)
    json.regions = changes.regions.map(regionEditOpToJson);
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
  if (!changes) return false;
  return Object.entries(changes).some(([field, value]) =>
    field === 'regions'
      ? Array.isArray(value) && value.length > 0
      : value !== undefined
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
  if (dto.decision === ObservationDecision.REJECT && dto.rejectReason !== undefined)
    json.rejectReason = dto.rejectReason;
  return json;
}
