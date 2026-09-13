/**
 * @module bim
 *
 * The BIM module (`MODULE_BIM`): a project's IFC models, their uploaded
 * versions, the worker jobs that import them, and the elements the worker
 * found. An element is identified across versions by its IFC GlobalId and
 * bridges to the QA/QC site structure through `spatialNodeId`, the
 * ELEMENT-level {@link SpatialNode} it became once the hierarchy proposal was
 * confirmed (design note `echno-roadmap/bim/bim-ingestion-viewer-element-identity.md`).
 *
 * The viewer never downloads the IFC: it asks for a {@link BimTileManifest}
 * and streams one presigned glTF tile per storey.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableBoolean,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';
import {
  PresignedUpload,
  parsePresignedUpload,
} from '../attachment/presigned-upload';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** How far an uploaded IFC got. `READY` is the only state the viewer opens. */
export type BimVersionStatus =
  | 'UPLOADED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'INGESTING'
  | 'READY'
  | 'FAILED';

export const bimVersionStatuses: readonly BimVersionStatus[] = [
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'INGESTING',
  'READY',
  'FAILED',
];

/** Lifecycle of one worker job. Poll while `QUEUED` or `RUNNING`. */
export type BimImportJobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

export const bimImportJobStatuses: readonly BimImportJobStatus[] = [
  'QUEUED',
  'RUNNING',
  'DONE',
  'FAILED',
];

/** True while a job can still change state. */
export function isBimJobActive(status: BimImportJobStatus | undefined): boolean {
  return status === 'QUEUED' || status === 'RUNNING';
}

/** True while a version is somewhere between upload and ready. */
export function isBimVersionInProgress(
  status: BimVersionStatus | undefined
): boolean {
  return (
    status === 'UPLOADED' ||
    status === 'QUEUED' ||
    status === 'PROCESSING' ||
    status === 'INGESTING'
  );
}

function parseEnum<T extends string>(
  raw: unknown,
  values: readonly T[],
  fallback: T
): T {
  return typeof raw === 'string' && (values as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

// ---------------------------------------------------------------------------
// Model and version
// ---------------------------------------------------------------------------

/** One uploaded IFC of a model and how far its import got. */
export interface BimModelVersion {
  id: string;
  modelId: string;
  versionNumber: number;
  status: BimVersionStatus;
  sourceFilename?: string;
  sourceSizeBytes?: number;
  ifcSchema?: string;
  elementCount?: number;
  storeyCount?: number;
  /** model-meta.json as the worker wrote it: units, site placement, true north, storeys. */
  meta: Record<string, unknown>;
  hierarchyProposed: boolean;
  hierarchyConfirmedAt?: string;
  importedAt?: string;
  error?: string;
  createdAt?: string;
}

/** A BIM model of a project with its versions, newest first. */
export interface BimModel {
  id: string;
  projectId: number;
  name: string;
  description?: string;
  /** The latest READY version, which the viewer opens by default. */
  currentVersionId?: string;
  versions: BimModelVersion[];
  createdAt?: string;
  updatedAt?: string;
}

const BimModelVersionSchema = z.object({
  id: z.string().nullish(),
  modelId: z.string().nullish(),
  versionNumber: nullableNumber,
  status: nullableString,
  sourceFilename: nullableString,
  sourceSizeBytes: nullableNumber,
  ifcSchema: nullableString,
  elementCount: nullableNumber,
  storeyCount: nullableNumber,
  meta: z.record(z.string(), z.unknown()).nullish(),
  hierarchyProposed: nullableBoolean,
  hierarchyConfirmedAt: backendDate,
  importedAt: backendDate,
  error: nullableString,
  createdAt: backendDate,
});

const BimModelSchema = z.object({
  id: z.string().nullish(),
  projectId: nullableNumber,
  name: nullableString,
  description: nullableString,
  currentVersionId: nullableString,
  versions: z.array(z.unknown()).nullish(),
  createdAt: backendDate,
  updatedAt: backendDate,
});

/** Parses a `BimModelVersionDto`. Non-strict: unknown keys are dropped. */
export function parseBimModelVersion(json: unknown): BimModelVersion {
  const raw = BimModelVersionSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseBimModelVersion.id'),
    modelId: raw.modelId ?? '',
    versionNumber: raw.versionNumber ?? 0,
    status: parseEnum(raw.status, bimVersionStatuses, 'UPLOADED'),
    sourceFilename: raw.sourceFilename ?? undefined,
    sourceSizeBytes: raw.sourceSizeBytes ?? undefined,
    ifcSchema: raw.ifcSchema ?? undefined,
    elementCount: raw.elementCount ?? undefined,
    storeyCount: raw.storeyCount ?? undefined,
    meta: raw.meta ?? {},
    hierarchyProposed: raw.hierarchyProposed ?? false,
    hierarchyConfirmedAt: raw.hierarchyConfirmedAt ?? undefined,
    importedAt: raw.importedAt ?? undefined,
    error: raw.error ?? undefined,
    createdAt: raw.createdAt ?? undefined,
  };
}

/** Parses a `BimModelDto` with its nested versions. */
export function parseBimModel(json: unknown): BimModel {
  const raw = BimModelSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseBimModel.id'),
    projectId: raw.projectId ?? 0,
    name: raw.name ?? '',
    description: raw.description ?? undefined,
    currentVersionId: raw.currentVersionId ?? undefined,
    versions: (raw.versions ?? []).map((v) => parseBimModelVersion(v)),
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Import job
// ---------------------------------------------------------------------------

/** A worker job for one model version. */
export interface BimImportJob {
  id: string;
  modelId: string;
  versionId: string;
  status: BimImportJobStatus;
  attempt: number;
  maxAttempts: number;
  workerId?: string;
  workerVersion?: string;
  elementCount?: number;
  storeyCount?: number;
  error?: string;
  queuedAt?: string;
  startedAt?: string;
  ingestedAt?: string;
  finishedAt?: string;
}

const BimImportJobSchema = z.object({
  id: z.string().nullish(),
  modelId: z.string().nullish(),
  versionId: z.string().nullish(),
  status: nullableString,
  attempt: nullableNumber,
  maxAttempts: nullableNumber,
  workerId: nullableString,
  workerVersion: nullableString,
  elementCount: nullableNumber,
  storeyCount: nullableNumber,
  error: nullableString,
  queuedAt: backendDate,
  startedAt: backendDate,
  ingestedAt: backendDate,
  finishedAt: backendDate,
});

/** Parses a `BimImportJobDto`. */
export function parseBimImportJob(json: unknown): BimImportJob {
  const raw = BimImportJobSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseBimImportJob.id'),
    modelId: raw.modelId ?? '',
    versionId: raw.versionId ?? '',
    status: parseEnum(raw.status, bimImportJobStatuses, 'QUEUED'),
    attempt: raw.attempt ?? 0,
    maxAttempts: raw.maxAttempts ?? 0,
    workerId: raw.workerId ?? undefined,
    workerVersion: raw.workerVersion ?? undefined,
    elementCount: raw.elementCount ?? undefined,
    storeyCount: raw.storeyCount ?? undefined,
    error: raw.error ?? undefined,
    queuedAt: raw.queuedAt ?? undefined,
    startedAt: raw.startedAt ?? undefined,
    ingestedAt: raw.ingestedAt ?? undefined,
    finishedAt: raw.finishedAt ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

/** Axis-aligned bounding box in model coordinates. */
export interface BimBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * One IfcProduct of a model, stable across versions by its IFC GlobalId.
 * `spatialNodeId` is the ELEMENT-level spatial node it became, if any.
 */
export interface BimElement {
  id: string;
  modelId: string;
  /** IFC GlobalId, 22 chars, the identity across versions. */
  globalId: string;
  ifcType: string;
  name?: string;
  storeyGlobalId?: string;
  spaceGlobalId?: string;
  properties: Record<string, unknown>;
  bbox?: BimBoundingBox;
  spatialNodeId?: string;
  firstSeenVersionId?: string;
  lastSeenVersionId?: string;
  /** Set when the element disappeared from the latest version. */
  retired: boolean;
  /** Set when a retired element was merged into its replacement. */
  mergedIntoId?: string;
}

/** A page of elements, the backend's own envelope. */
export interface BimElementPage {
  content: BimElement[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const BimElementSchema = z.object({
  id: z.string().nullish(),
  modelId: z.string().nullish(),
  globalId: nullableString,
  ifcType: nullableString,
  name: nullableString,
  storeyGlobalId: nullableString,
  spaceGlobalId: nullableString,
  properties: z.record(z.string(), z.unknown()).nullish(),
  bbox: z.record(z.string(), z.unknown()).nullish(),
  spatialNodeId: nullableString,
  firstSeenVersionId: nullableString,
  lastSeenVersionId: nullableString,
  retired: nullableBoolean,
  mergedIntoId: nullableString,
});

const BimElementPageSchema = z.object({
  content: z.array(z.unknown()).nullish(),
  page: nullableNumber,
  size: nullableNumber,
  totalElements: nullableNumber,
  totalPages: nullableNumber,
});

function triple(raw: unknown): [number, number, number] | undefined {
  if (!Array.isArray(raw) || raw.length < 3) return undefined;
  const nums = raw.slice(0, 3).map((v) => Number(v));
  return nums.every((n) => Number.isFinite(n))
    ? (nums as [number, number, number])
    : undefined;
}

/**
 * Reads the worker's bbox. Accepts `{min:[x,y,z], max:[x,y,z]}` and the flat
 * `{minX..maxZ}` form; anything else reads as no bbox.
 */
export function parseBimBoundingBox(raw: unknown): BimBoundingBox | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const min = triple(r.min);
  const max = triple(r.max);
  if (min && max) return { min, max };
  const flat = ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ'].map((k) =>
    Number(r[k])
  );
  if (flat.every((n) => Number.isFinite(n))) {
    return {
      min: [flat[0], flat[1], flat[2]],
      max: [flat[3], flat[4], flat[5]],
    };
  }
  return undefined;
}

/** Parses a `BimElementDto`. */
export function parseBimElement(json: unknown): BimElement {
  const raw = BimElementSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseBimElement.id'),
    modelId: raw.modelId ?? '',
    globalId: raw.globalId ?? '',
    ifcType: raw.ifcType ?? '',
    name: raw.name ?? undefined,
    storeyGlobalId: raw.storeyGlobalId ?? undefined,
    spaceGlobalId: raw.spaceGlobalId ?? undefined,
    properties: raw.properties ?? {},
    bbox: parseBimBoundingBox(raw.bbox),
    spatialNodeId: raw.spatialNodeId ?? undefined,
    firstSeenVersionId: raw.firstSeenVersionId ?? undefined,
    lastSeenVersionId: raw.lastSeenVersionId ?? undefined,
    retired: raw.retired ?? false,
    mergedIntoId: raw.mergedIntoId ?? undefined,
  };
}

/** Parses a `BimElementPageDto`. */
export function parseBimElementPage(json: unknown): BimElementPage {
  const raw = BimElementPageSchema.parse(json);
  const content = (raw.content ?? []).map((e) => parseBimElement(e));
  return {
    content,
    page: raw.page ?? 0,
    size: raw.size ?? content.length,
    totalElements: raw.totalElements ?? content.length,
    totalPages: raw.totalPages ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

/** One storey's glTF tile with its short-lived presigned GET url. */
export interface BimStoreyTile {
  globalId: string;
  name: string;
  elevation?: number;
  elementCount?: number;
  url: string;
}

/** Presigned GET urls for a version's tiles, one per storey plus the coarse whole model. */
export interface BimTileManifest {
  modelId: string;
  versionId: string;
  /** Decimated whole model for the first paint. */
  coarseUrl?: string;
  /** Products with no storey, if any. */
  unassignedUrl?: string;
  storeys: BimStoreyTile[];
  expiresInSeconds: number;
}

const BimStoreyTileSchema = z.object({
  globalId: nullableString,
  name: nullableString,
  elevation: nullableNumber,
  elementCount: nullableNumber,
  url: nullableString,
});

const BimTileManifestSchema = z.object({
  modelId: z.string().nullish(),
  versionId: z.string().nullish(),
  coarseUrl: nullableString,
  unassignedUrl: nullableString,
  storeys: z.array(BimStoreyTileSchema).nullish(),
  expiresInSeconds: nullableNumber,
});

/** Parses a `BimTileManifestDto`. Storeys keep the backend's order (by elevation). */
export function parseBimTileManifest(json: unknown): BimTileManifest {
  const raw = BimTileManifestSchema.parse(json);
  return {
    modelId: raw.modelId ?? '',
    versionId: raw.versionId ?? '',
    coarseUrl: raw.coarseUrl ?? undefined,
    unassignedUrl: raw.unassignedUrl ?? undefined,
    storeys: (raw.storeys ?? []).map((s) => ({
      globalId: s.globalId ?? '',
      name: s.name ?? s.globalId ?? '',
      elevation: s.elevation ?? undefined,
      elementCount: s.elementCount ?? undefined,
      url: s.url ?? '',
    })),
    expiresInSeconds: raw.expiresInSeconds ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Hierarchy proposal
// ---------------------------------------------------------------------------

export interface ProposedBimElement {
  globalId: string;
  code: string;
  name: string;
  ifcType?: string;
  elementType?: string;
  /** The existing spatial node this would match instead of creating one. */
  matchedNodeId?: string;
}

export interface ProposedBimZone {
  globalId?: string;
  code: string;
  name: string;
  /** True for the catch-all zone of a storey without IfcSpaces. */
  defaultZone: boolean;
  matchedNodeId?: string;
  elements: ProposedBimElement[];
}

export interface ProposedBimFloor {
  globalId: string;
  code: string;
  name: string;
  levelIndex?: number;
  elevation?: number;
  matchedNodeId?: string;
  zones: ProposedBimZone[];
}

export interface ProposedBimBuilding {
  globalId: string;
  code: string;
  name: string;
  matchedNodeId?: string;
  floors: ProposedBimFloor[];
}

/** What the last confirmation did. */
export interface BimHierarchyConfirmResult {
  confirmedAt?: string;
  nodesCreated: number;
  nodesMatched: number;
  elementsLinked: number;
  elementsSkipped: number;
}

/** A proposed site structure from an IFC's spatial containment, pending confirmation. */
export interface BimHierarchyProposal {
  versionId: string;
  generatedAt?: string;
  confirmedAt?: string;
  /** buildings, floors, zones, elements proposed; matched; unplaced (no storey). */
  counts: Record<string, number>;
  buildings: ProposedBimBuilding[];
  confirmation?: BimHierarchyConfirmResult;
}

const ProposedElementSchema = z.object({
  globalId: nullableString,
  code: nullableString,
  name: nullableString,
  ifcType: nullableString,
  elementType: nullableString,
  matchedNodeId: nullableString,
});
const ProposedZoneSchema = z.object({
  globalId: nullableString,
  code: nullableString,
  name: nullableString,
  defaultZone: nullableBoolean,
  matchedNodeId: nullableString,
  elements: z.array(ProposedElementSchema).nullish(),
});
const ProposedFloorSchema = z.object({
  globalId: nullableString,
  code: nullableString,
  name: nullableString,
  levelIndex: nullableNumber,
  elevation: nullableNumber,
  matchedNodeId: nullableString,
  zones: z.array(ProposedZoneSchema).nullish(),
});
const ProposedBuildingSchema = z.object({
  globalId: nullableString,
  code: nullableString,
  name: nullableString,
  matchedNodeId: nullableString,
  floors: z.array(ProposedFloorSchema).nullish(),
});
const ConfirmResultSchema = z.object({
  confirmedAt: backendDate,
  nodesCreated: nullableNumber,
  nodesMatched: nullableNumber,
  elementsLinked: nullableNumber,
  elementsSkipped: nullableNumber,
});
const BimHierarchyProposalSchema = z.object({
  versionId: z.string().nullish(),
  generatedAt: backendDate,
  confirmedAt: backendDate,
  counts: z.record(z.string(), z.number()).nullish(),
  buildings: z.array(ProposedBuildingSchema).nullish(),
  confirmation: ConfirmResultSchema.nullish(),
});

/** Parses a `BimHierarchyProposalDto` down to the proposed elements. */
export function parseBimHierarchyProposal(json: unknown): BimHierarchyProposal {
  const raw = BimHierarchyProposalSchema.parse(json);
  return {
    versionId: raw.versionId ?? '',
    generatedAt: raw.generatedAt ?? undefined,
    confirmedAt: raw.confirmedAt ?? undefined,
    counts: raw.counts ?? {},
    buildings: (raw.buildings ?? []).map((b) => ({
      globalId: b.globalId ?? '',
      code: b.code ?? '',
      name: b.name ?? b.code ?? '',
      matchedNodeId: b.matchedNodeId ?? undefined,
      floors: (b.floors ?? []).map((f) => ({
        globalId: f.globalId ?? '',
        code: f.code ?? '',
        name: f.name ?? f.code ?? '',
        levelIndex: f.levelIndex ?? undefined,
        elevation: f.elevation ?? undefined,
        matchedNodeId: f.matchedNodeId ?? undefined,
        zones: (f.zones ?? []).map((zn) => ({
          globalId: zn.globalId ?? undefined,
          code: zn.code ?? '',
          name: zn.name ?? zn.code ?? '',
          defaultZone: zn.defaultZone ?? false,
          matchedNodeId: zn.matchedNodeId ?? undefined,
          elements: (zn.elements ?? []).map((e) => ({
            globalId: e.globalId ?? '',
            code: e.code ?? '',
            name: e.name ?? e.code ?? '',
            ifcType: e.ifcType ?? undefined,
            elementType: e.elementType ?? undefined,
            matchedNodeId: e.matchedNodeId ?? undefined,
          })),
        })),
      })),
    })),
    confirmation: raw.confirmation
      ? {
          confirmedAt: raw.confirmation.confirmedAt ?? undefined,
          nodesCreated: raw.confirmation.nodesCreated ?? 0,
          nodesMatched: raw.confirmation.nodesMatched ?? 0,
          elementsLinked: raw.confirmation.elementsLinked ?? 0,
          elementsSkipped: raw.confirmation.elementsSkipped ?? 0,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Upload presign
// ---------------------------------------------------------------------------

/** The version created for an upload and the short-lived PUT url for its source IFC. */
export interface BimSourceUpload {
  versionId: string;
  versionNumber: number;
  upload: PresignedUpload;
}

const BimSourceUploadSchema = z.object({
  versionId: z.string().nullish(),
  versionNumber: nullableNumber,
  upload: z.unknown(),
});

/** Parses a `BimSourceUploadDto`. Throws when the presigned slot is unusable. */
export function parseBimSourceUpload(json: unknown): BimSourceUpload {
  const raw = BimSourceUploadSchema.parse(json);
  return {
    versionId: parseUuid(raw.versionId, 'parseBimSourceUpload.versionId'),
    versionNumber: raw.versionNumber ?? 0,
    upload: parsePresignedUpload(raw.upload),
  };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Registers a BIM model on a project. Versions are added by uploading an IFC. */
export interface CreateBimModelRequest {
  /** Max 200. Required. */
  name: string;
  /** Max 2000. */
  description?: string;
}

/** Upload size cap the backend enforces on an IFC (1 GB). */
export const BIM_SOURCE_MAX_BYTES = 1024 * 1024 * 1024;

/** Declares the IFC about to be uploaded. Creates the next version and returns where to PUT it. */
export interface PresignBimSourceRequest {
  /** Max 300. Required. */
  filename: string;
  /** Bytes, positive. Required. */
  fileSize: number;
  /** Max 100. Defaults server-side. */
  contentType?: string;
}

/** Confirms the proposal. By default every proposed node is created or matched. */
export interface ConfirmBimHierarchyRequest {
  /** False to confirm buildings, floors and zones only and leave elements for later. */
  includeElements?: boolean;
  /** Confirm only these element GlobalIds; omit for all. */
  elementGlobalIds?: string[];
}

/** Carries a retired element's link onto the element that replaced it. */
export interface MergeBimElementRequest {
  intoElementId: string;
}

/** Filters for the paged element list of a model. */
export interface BimElementListParams {
  storeyGlobalId?: string;
  includeRetired?: boolean;
  page?: number;
  size?: number;
}

export function createBimModelToJson(
  req: CreateBimModelRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  payload.name = req.name;
  if (req.description !== undefined) payload.description = req.description;
  return payload;
}

export function presignBimSourceToJson(
  req: PresignBimSourceRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  payload.filename = req.filename;
  payload.fileSize = req.fileSize;
  if (req.contentType !== undefined) payload.contentType = req.contentType;
  return payload;
}

export function confirmBimHierarchyToJson(
  req: ConfirmBimHierarchyRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (req.includeElements !== undefined) payload.includeElements = req.includeElements;
  if (req.elementGlobalIds !== undefined) payload.elementGlobalIds = req.elementGlobalIds;
  return payload;
}

export function mergeBimElementToJson(
  req: MergeBimElementRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  payload.intoElementId = req.intoElementId;
  return payload;
}
