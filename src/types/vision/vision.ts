/**
 * @module vision
 *
 * Domain types for the Computer Vision module (`MODULE_VISION`; backend
 * design note `docs/specs/2026-10-26-cv-phase4-design.md`, sections 4.2 and
 * 4.6): the model registry, the organization's inference settings, and the
 * request that queues a run.
 *
 * The registry is a platform-wide catalogue. A model family (`ppe`,
 * `concrete-defects`) has its own class list and its own versions, of which
 * at most one is `ACTIVE`. A version's classes are a subset of the class
 * taxonomy; object and PPE classes are boxes, defect classes polygons.
 *
 * The regions a model draws, and the review of them, are inspection types
 * (`ObservationRegion`, `RegionEditOp`, `ReviewBatchRequest`): a person can
 * draw a region without any model, so they live with the observation.
 *
 * Unlike the inspection enums, the registry enums cross the wire as their
 * Java constant names (`DETECT`, `ACTIVE`), so the values here are upper
 * case. The parsers are non-strict: a field the backend adds later never
 * breaks this client.
 */

import { z } from 'zod';
import {
  backendDate,
  nullableBoolean,
  nullableString,
  optionalNumericId,
} from '../../lib/validation/backend-schema';
import { parseRegionShape, RegionShape } from '../inspection/observation';

/** What a family's models produce. `DETECT` draws boxes, `SEGMENT` polygons. */
export enum CvModelTask {
  DETECT = 'DETECT',
  SEGMENT = 'SEGMENT',
}

/** The inspection problem a model family answers. */
export enum CvModelFamily {
  SAFETY = 'SAFETY',
  DEFECT = 'DEFECT',
  OBJECT = 'OBJECT',
  PROGRESS = 'PROGRESS',
}

/** Human-readable label for each {@link CvModelFamily}. */
export const cvModelFamilyLabels: Record<CvModelFamily, string> = {
  [CvModelFamily.SAFETY]: 'Safety',
  [CvModelFamily.DEFECT]: 'Defects',
  [CvModelFamily.OBJECT]: 'Objects',
  [CvModelFamily.PROGRESS]: 'Progress',
};

/**
 * Where a model version is in its life. `RETIRED` is terminal, and at most
 * one version of a model is `ACTIVE` at a time.
 */
export enum CvModelVersionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}

/** Human-readable label for each {@link CvModelVersionStatus}. */
export const cvModelVersionStatusLabels: Record<CvModelVersionStatus, string> = {
  [CvModelVersionStatus.DRAFT]: 'Draft',
  [CvModelVersionStatus.ACTIVE]: 'Active',
  [CvModelVersionStatus.RETIRED]: 'Retired',
};

function narrow<T extends string>(values: readonly T[], raw: unknown, fallback: T): T {
  return typeof raw === 'string' && (values as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

/** Narrows a backend string to {@link CvModelTask}, defaulting to `DETECT`. */
export function parseCvModelTask(raw: unknown): CvModelTask {
  return narrow(Object.values(CvModelTask), raw, CvModelTask.DETECT);
}

/** Narrows a backend string to {@link CvModelFamily}, defaulting to `OBJECT`. */
export function parseCvModelFamily(raw: unknown): CvModelFamily {
  return narrow(Object.values(CvModelFamily), raw, CvModelFamily.OBJECT);
}

/**
 * Narrows a backend string to {@link CvModelVersionStatus}, defaulting to
 * `DRAFT`: a version whose status cannot be read is never offered as the
 * one that runs.
 */
export function parseCvModelVersionStatus(raw: unknown): CvModelVersionStatus {
  return narrow(Object.values(CvModelVersionStatus), raw, CvModelVersionStatus.DRAFT);
}

/** One class a model version outputs (backend `CvModelClassDto`). */
export interface CvModelClass {
  /** Class key from the taxonomy, e.g. `ppe_helmet`. */
  key: string;
  /**
   * The shape the taxonomy gives the class. The registry writes `BOX` or
   * `POLYGON`; it is read into the same {@link RegionShape} a region
   * carries, so a class and a region compare directly.
   */
  shape: RegionShape;
  /** Operating threshold in `[0, 1]` chosen when the version was evaluated. */
  threshold: number;
}

/** One trained version of a model family (backend `CvModelVersionDto`). */
export interface CvModelVersion {
  /** UUID primary key. */
  id: string;
  /** The family's key. */
  modelKey: string;
  /** Semantic version, unique within the family. */
  version: string;
  /** Where it is in its life. */
  status: CvModelVersionStatus;
  /** The classes it outputs. */
  classes: CvModelClass[];
  /** SPDX licence id of the weights. */
  licence: string;
  /** What it was fine-tuned from, e.g. `rf-detr-nano COCO (Apache-2.0)`. */
  baseWeights: string;
  /** Where the weights are stored. */
  weightsUri: string;
  /** SHA-256 of the weights file. */
  weightsSha256: string;
  /** Inference runtime, e.g. `onnxruntime`. */
  runtime: string;
  /** Model input size in pixels. */
  inputSize: number;
  /** Dataset release it was trained on. */
  trainingRelease?: string;
  /** Training run record. */
  trainingRunUri?: string;
  /** Summary metrics from the run record, in the trainer's own shape. */
  metrics?: Record<string, unknown>;
  /** Evaluation report. */
  evalReportUri?: string;
  /** User who registered it; unset for a service account. */
  registeredById?: number;
  /** When it became active (ISO string). */
  activatedAt?: string;
  /** When it was retired (ISO string). */
  retiredAt?: string;
  /** Creation timestamp (ISO string). */
  createdAt?: string;
  /** Last-update timestamp (ISO string). */
  updatedAt?: string;
}

/** A model family with its versions, oldest first (backend `CvModelDto`). */
export interface CvModel {
  /** Stable key, e.g. `ppe`. Observations carry it as `modelName`. */
  key: string;
  /** Display name. */
  name: string;
  /** What its models produce. */
  task: CvModelTask;
  /** The inspection problem it answers. */
  family: CvModelFamily;
  /** Every version, oldest first. */
  versions: CvModelVersion[];
}

const numberLike = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
  z.number().finite().nullish()
);

const CvModelClassSchema = z.object({
  key: nullableString,
  shape: z.unknown().nullish(),
  threshold: numberLike,
});

const CvModelVersionSchema = z.object({
  id: nullableString,
  modelKey: nullableString,
  version: nullableString,
  status: z.unknown().nullish(),
  classes: z.array(CvModelClassSchema).nullish(),
  licence: nullableString,
  baseWeights: nullableString,
  weightsUri: nullableString,
  weightsSha256: nullableString,
  runtime: nullableString,
  inputSize: numberLike,
  trainingRelease: nullableString,
  trainingRunUri: nullableString,
  metrics: z.record(z.string(), z.unknown()).nullish(),
  evalReportUri: nullableString,
  registeredById: optionalNumericId,
  activatedAt: backendDate,
  retiredAt: backendDate,
  createdAt: backendDate,
  updatedAt: backendDate,
});

const CvModelSchema = z.object({
  key: nullableString,
  name: nullableString,
  task: z.unknown().nullish(),
  family: z.unknown().nullish(),
  versions: z.array(z.unknown()).nullish(),
});

function requireText(value: string | null | undefined, context: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${context}: expected a non-empty string, got ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Parses a raw class entry into a {@link CvModelClass}.
 *
 * @throws {TypeError} If `key` is missing.
 */
export function parseCvModelClass(json: unknown): CvModelClass {
  const raw = CvModelClassSchema.parse(json);
  return {
    key: requireText(raw.key, 'parseCvModelClass.key'),
    shape: parseRegionShape(raw.shape),
    threshold: raw.threshold ?? 0,
  };
}

/**
 * Parses a raw model version into a {@link CvModelVersion}.
 *
 * @throws {TypeError} If `id` or `version` is missing.
 */
export function parseCvModelVersion(json: unknown): CvModelVersion {
  const raw = CvModelVersionSchema.parse(json);
  return {
    id: requireText(raw.id, 'parseCvModelVersion.id'),
    modelKey: raw.modelKey ?? '',
    version: requireText(raw.version, 'parseCvModelVersion.version'),
    status: parseCvModelVersionStatus(raw.status),
    classes: (raw.classes ?? []).map((item) => parseCvModelClass(item)),
    licence: raw.licence ?? '',
    baseWeights: raw.baseWeights ?? '',
    weightsUri: raw.weightsUri ?? '',
    weightsSha256: raw.weightsSha256 ?? '',
    runtime: raw.runtime ?? '',
    inputSize: raw.inputSize ?? 0,
    trainingRelease: raw.trainingRelease ?? undefined,
    trainingRunUri: raw.trainingRunUri ?? undefined,
    metrics: raw.metrics ?? undefined,
    evalReportUri: raw.evalReportUri ?? undefined,
    registeredById: raw.registeredById ?? undefined,
    activatedAt: raw.activatedAt ?? undefined,
    retiredAt: raw.retiredAt ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

/**
 * Parses a raw model family into a {@link CvModel}. A version's `modelKey`
 * falls back to the family's key when the backend left it out.
 *
 * @throws {TypeError} If `key`, or a version's `id` or `version`, is missing.
 */
export function parseCvModel(json: unknown): CvModel {
  const raw = CvModelSchema.parse(json);
  const key = requireText(raw.key, 'parseCvModel.key');
  return {
    key,
    name: raw.name ?? key,
    task: parseCvModelTask(raw.task),
    family: parseCvModelFamily(raw.family),
    versions: (raw.versions ?? []).map((item) => {
      const version = parseCvModelVersion(item);
      return version.modelKey ? version : { ...version, modelKey: key };
    }),
  };
}

/**
 * The version of a family that runs: the one `ACTIVE` version, if any.
 *
 * @param model - The model family.
 * @returns The active version, or `undefined` when none is active.
 */
export function activeCvModelVersion(model: CvModel): CvModelVersion | undefined {
  return model.versions.find((version) => version.status === CvModelVersionStatus.ACTIVE);
}

/* ------------------------------------------------------------ the settings */

/**
 * An organization's inference settings (`GET /vision/web/settings`). An
 * organization that has never saved any reads as auto-inference off, no
 * model keys and no author.
 */
export interface VisionSettings {
  /** Whether new evidence images are sent for inference automatically. */
  autoInfer: boolean;
  /**
   * Model family keys to run. Empty means every family that has an `ACTIVE`
   * version, so a family added later runs without a settings change.
   */
  modelKeys: string[];
  /** Employee who last saved the settings; `null` before the first save. */
  updatedById: number | null;
  /** When they were last saved (ISO string); `null` before the first save. */
  updatedAt: string | null;
}

const VisionSettingsSchema = z.object({
  autoInfer: nullableBoolean,
  modelKeys: z.array(z.string()).nullish(),
  updatedById: optionalNumericId,
  updatedAt: backendDate,
});

/**
 * Parses a raw settings payload into {@link VisionSettings}. A missing
 * field reads as the never-saved default.
 */
export function parseVisionSettings(json: unknown): VisionSettings {
  const raw = VisionSettingsSchema.parse(json ?? {});
  return {
    autoInfer: raw.autoInfer ?? false,
    modelKeys: raw.modelKeys ?? [],
    updatedById: raw.updatedById ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

/** The body of `PUT /vision/web/settings` (org admins): the whole settings, replaced. */
export interface UpdateVisionSettingsRequest {
  /** Whether new evidence images are sent for inference automatically. */
  autoInfer: boolean;
  /** Model family keys to run; empty for every family with an active version. */
  modelKeys: string[];
}

/**
 * Serializes an {@link UpdateVisionSettingsRequest} into the backend body.
 *
 * @param dto - The settings to save.
 * @returns A plain object matching the backend request.
 */
export function updateVisionSettingsToJson(
  dto: UpdateVisionSettingsRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  json.autoInfer = dto.autoInfer;
  json.modelKeys = dto.modelKeys;
  return json;
}

/* ------------------------------------------------------------------ a run */

/** Most attachment ids one run request takes. */
export const VISION_RUN_MAX_ATTACHMENTS = 200;

/**
 * Asks for inference on a set of images (`POST /vision/web/runs`). Exactly
 * one source: every image of an inspection, every image an observation
 * cites, or a list of attachments. Needs `vision:run`.
 */
export interface QueueVisionRunRequest {
  /** Run every evidence image of this inspection. */
  inspectionId?: string;
  /** Run every image this observation cites. */
  observationId?: string;
  /** Run these attachments, 1 to {@link VISION_RUN_MAX_ATTACHMENTS}. */
  attachmentIds?: number[];
  /** Model family keys to run; omit to let the backend choose from the organization's settings. */
  modelKeys?: string[];
  /**
   * Run again an image that already has a finished job for the same model
   * version. An image with a job still queued or running is skipped either way.
   */
  rerun?: boolean;
}

/**
 * Serializes a {@link QueueVisionRunRequest} into the backend body.
 *
 * The source rule is checked first, so a form gets a plain error before the
 * round trip.
 *
 * @param dto - The run request.
 * @returns A plain object matching the backend request.
 * @throws {TypeError} When not exactly one source is set, or `attachmentIds`
 *   is empty or longer than {@link VISION_RUN_MAX_ATTACHMENTS}.
 */
export function queueVisionRunToJson(dto: QueueVisionRunRequest): Record<string, unknown> {
  const sources = [dto.inspectionId, dto.observationId, dto.attachmentIds].filter(
    (source) => source !== undefined
  );
  if (sources.length !== 1) {
    throw new TypeError(
      'A vision run needs exactly one of inspectionId, observationId or attachmentIds.'
    );
  }
  if (dto.attachmentIds !== undefined) {
    if (dto.attachmentIds.length === 0) {
      throw new TypeError('A vision run needs at least one attachment.');
    }
    if (dto.attachmentIds.length > VISION_RUN_MAX_ATTACHMENTS) {
      throw new TypeError(
        `A vision run takes at most ${VISION_RUN_MAX_ATTACHMENTS} attachments.`
      );
    }
  }
  const json: Record<string, unknown> = {};
  if (dto.inspectionId !== undefined) json.inspectionId = dto.inspectionId;
  if (dto.observationId !== undefined) json.observationId = dto.observationId;
  if (dto.attachmentIds !== undefined) json.attachmentIds = dto.attachmentIds;
  if (dto.modelKeys !== undefined) json.modelKeys = dto.modelKeys;
  if (dto.rerun !== undefined) json.rerun = dto.rerun;
  return json;
}

/** What a run request queued, and what it skipped. */
export interface QueueVisionRunResult {
  /** Images queued for inference. */
  queued: number;
  /** Images skipped because a job for the same version is pending, or has finished and `rerun` was not set. */
  skippedDuplicate: number;
  /** Attachments skipped because they are not images. */
  skippedNotImage: number;
}

const QueueVisionRunResultSchema = z.object({
  queued: numberLike,
  skippedDuplicate: numberLike,
  skippedNotImage: numberLike,
});

/** Parses a raw run result into {@link QueueVisionRunResult}; a missing count is 0. */
export function parseQueueVisionRunResult(json: unknown): QueueVisionRunResult {
  const raw = QueueVisionRunResultSchema.parse(json ?? {});
  return {
    queued: raw.queued ?? 0,
    skippedDuplicate: raw.skippedDuplicate ?? 0,
    skippedNotImage: raw.skippedNotImage ?? 0,
  };
}
