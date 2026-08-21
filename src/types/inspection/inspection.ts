/**
 * @module types/inspection/inspection
 *
 * The {@link Inspection} entity with its {@link InspectionCheckItem} and
 * {@link InspectionDefect} rows (backend `InspectionDto` /
 * `InspectionCheckItemDto` / `InspectionDefectDto`), plus parsers, the
 * inspection enums, and the create / update request payloads with their
 * serializers.
 *
 * The inspection keys its cross-domain references (project, inspector,
 * contractor) by the numeric surrogate ids used across the operational
 * modules; only its own primary key and the check-item / defect ids are UUID
 * strings. The summary counts (total, passed, failed check points and the
 * defect count) are derived server-side from the supplied check items and
 * defects; the client does not set them.
 *
 * Every inspection enum uses the hyphenated wire values emitted by the backend
 * (`@JsonValue`): `in-progress`, `passed-with-remarks`, `not-applicable`, the
 * bare `final`, and so on. The string values here must match those exactly; do
 * not rename without coordinating a backend change.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableBoolean,
  nullableNumber,
  nullableString,
  numericId,
  optionalNumericId,
  opaque,
} from '../../lib/validation/backend-schema';

/** The kind of site inspection being carried out. */
export enum InspectionType {
  SAFETY = 'safety',
  QUALITY = 'quality',
  PROGRESS = 'progress',
  FINAL = 'final',
  STRUCTURAL = 'structural',
  ELECTRICAL = 'electrical',
  PLUMBING = 'plumbing',
  FINISHING = 'finishing',
  COMPLIANCE = 'compliance',
}

/** Lifecycle state of an inspection. */
export enum InspectionStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PASSED = 'passed',
  PASSED_WITH_REMARKS = 'passed-with-remarks',
  CANCELLED = 'cancelled',
  /** Proposed by the AI compliance generation flow, awaiting review. */
  SUGGESTED = 'suggested',
}

/**
 * How an inspection came to exist: entered by a user (`MANUAL`) or produced by
 * the AI compliance generation flow (`AI_GENERATED`). The backend defaults it
 * to `MANUAL`.
 */
export enum InspectionOrigin {
  MANUAL = 'manual',
  AI_GENERATED = 'ai-generated',
}

/**
 * Risk severity attached to a compliance-type inspection. Set only on
 * compliance inspections; unset on ordinary ones.
 */
export enum ComplianceRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Stage of the construction lifecycle a compliance applies to. Set only on
 * compliance inspections; unset on ordinary ones.
 */
export enum CompliancePhase {
  PRE_CONSTRUCTION = 'pre-construction',
  ONGOING = 'ongoing',
  POST_CONSTRUCTION = 'post-construction',
}

/** Outcome of a completed inspection (unset until it is concluded). */
export enum InspectionResult {
  PASSED = 'passed',
  FAILED = 'failed',
  PASSED_WITH_REMARKS = 'passed-with-remarks',
  PENDING = 'pending',
}

/** Per-check-point outcome within an inspection. */
export enum CheckItemStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  NOT_APPLICABLE = 'not-applicable',
  PENDING = 'pending',
}

/**
 * Narrows an untyped backend string to {@link InspectionType}, defaulting to
 * `QUALITY` when the value is absent or unrecognized.
 */
export function parseInspectionType(raw: unknown): InspectionType {
  return typeof raw === 'string' &&
    (Object.values(InspectionType) as string[]).includes(raw)
    ? (raw as InspectionType)
    : InspectionType.QUALITY;
}

/**
 * Narrows an untyped backend string to {@link InspectionStatus}, defaulting to
 * `SCHEDULED` when the value is absent or unrecognized.
 */
export function parseInspectionStatus(raw: unknown): InspectionStatus {
  return typeof raw === 'string' &&
    (Object.values(InspectionStatus) as string[]).includes(raw)
    ? (raw as InspectionStatus)
    : InspectionStatus.SCHEDULED;
}

/**
 * Narrows an untyped backend string to {@link InspectionOrigin}, defaulting to
 * `MANUAL` when the value is absent or unrecognized (mirroring the backend
 * entity default).
 */
export function parseInspectionOrigin(raw: unknown): InspectionOrigin {
  return typeof raw === 'string' &&
    (Object.values(InspectionOrigin) as string[]).includes(raw)
    ? (raw as InspectionOrigin)
    : InspectionOrigin.MANUAL;
}

/**
 * Narrows an untyped backend string to {@link ComplianceRiskLevel}, or
 * `undefined` when the value is absent or unrecognized. Only compliance
 * inspections carry a risk level, so a missing value is preserved as unset.
 */
export function parseComplianceRiskLevel(
  raw: unknown
): ComplianceRiskLevel | undefined {
  return typeof raw === 'string' &&
    (Object.values(ComplianceRiskLevel) as string[]).includes(raw)
    ? (raw as ComplianceRiskLevel)
    : undefined;
}

/**
 * Narrows an untyped backend string to {@link CompliancePhase}, or `undefined`
 * when the value is absent or unrecognized. Only compliance inspections carry a
 * phase, so a missing value is preserved as unset.
 */
export function parseCompliancePhase(
  raw: unknown
): CompliancePhase | undefined {
  return typeof raw === 'string' &&
    (Object.values(CompliancePhase) as string[]).includes(raw)
    ? (raw as CompliancePhase)
    : undefined;
}

/**
 * Narrows an untyped backend string to {@link InspectionResult}, or `undefined`
 * when the value is absent or unrecognized. The backend leaves the result unset
 * until the inspection is concluded, so a missing result is preserved as unset
 * rather than defaulted.
 */
export function parseInspectionResult(raw: unknown): InspectionResult | undefined {
  return typeof raw === 'string' &&
    (Object.values(InspectionResult) as string[]).includes(raw)
    ? (raw as InspectionResult)
    : undefined;
}

/**
 * Narrows an untyped backend string to {@link CheckItemStatus}, defaulting to
 * `PENDING` when the value is absent or unrecognized.
 */
export function parseCheckItemStatus(raw: unknown): CheckItemStatus {
  return typeof raw === 'string' &&
    (Object.values(CheckItemStatus) as string[]).includes(raw)
    ? (raw as CheckItemStatus)
    : CheckItemStatus.PENDING;
}

const InspectionCheckItemSchema = z.object({
  id: z.string().nullish(),
  category: nullableString,
  checkPoint: nullableString,
  specification: nullableString,
  status: opaque,
  remarks: nullableString,
  photosRequired: nullableBoolean,
  photos: z.array(z.string()).nullish(),
  measurement: nullableString,
  expectedValue: nullableString,
  priority: nullableString,
});

const InspectionDefectSchema = z.object({
  id: z.string().nullish(),
  category: nullableString,
  description: nullableString,
  severity: nullableString,
  location: nullableString,
  photos: z.array(z.string()).nullish(),
  correctiveAction: nullableString,
  responsibleParty: nullableString,
  targetDate: backendDate,
  status: nullableString,
  resolvedDate: backendDate,
});

const InspectionSchema = z.object({
  id: z.string().nullish(),
  inspectionNumber: nullableString,
  title: nullableString,
  type: opaque,
  status: opaque,
  result: opaque,
  projectId: optionalNumericId,
  location: nullableString,
  areaInspected: nullableString,
  drawingReference: nullableString,
  scheduledDate: backendDate,
  scheduledTime: nullableString,
  actualStartTime: backendDate,
  actualEndTime: backendDate,
  duration: nullableNumber,
  inspectorId: numericId,
  contractorId: optionalNumericId,
  clientRepresentative: nullableString,
  attendees: z.array(z.string()).nullish(),
  weatherConditions: nullableString,
  temperature: nullableString,
  totalCheckPoints: nullableNumber,
  passedCheckPoints: nullableNumber,
  failedCheckPoints: nullableNumber,
  defectsFound: nullableNumber,
  origin: opaque,
  compliancePhase: opaque,
  riskLevel: opaque,
  resolutionOptions: nullableString,
  complianceRuleRef: nullableString,
  aiRationale: nullableString,
  checkItems: z.array(z.unknown()).nullish(),
  defects: z.array(z.unknown()).nullish(),
  createdAt: backendDate,
  updatedAt: backendDate,
});

/** A single check point evaluated during an inspection. */
export interface InspectionCheckItem {
  /** UUID primary key. */
  id: string;
  /** Grouping category for the check point. */
  category: string;
  /** The check point itself. */
  checkPoint: string;
  /** Specification or acceptance criterion. */
  specification?: string;
  /** Per-check-point outcome. */
  status: CheckItemStatus;
  /** Inspector remarks. */
  remarks?: string;
  /** Whether photo evidence is required for this check point. */
  photosRequired: boolean;
  /** Attached photo references. */
  photos: string[];
  /** Measured value, where applicable. */
  measurement?: string;
  /** Expected value for the measurement. */
  expectedValue?: string;
  /** Priority (free text). */
  priority?: string;
}

/** A defect recorded against an inspection. */
export interface InspectionDefect {
  /** UUID primary key. */
  id: string;
  /** Defect category (free text). */
  category?: string;
  /** Description of the defect. */
  description: string;
  /** Severity (free text). */
  severity?: string;
  /** Where on site the defect was found. */
  location?: string;
  /** Attached photo references. */
  photos: string[];
  /** Corrective action required. */
  correctiveAction: string;
  /** Party responsible for the fix. */
  responsibleParty?: string;
  /** Target resolution date (`YYYY-MM-DD`). */
  targetDate?: string;
  /** Defect status (free text). */
  status?: string;
  /** Date the defect was resolved (`YYYY-MM-DD`). */
  resolvedDate?: string;
}

/** A site inspection with its check points and recorded defects. */
export interface Inspection {
  /** UUID primary key. */
  id: string;
  /** Human-facing inspection number. */
  inspectionNumber: string;
  /** Inspection title. */
  title: string;
  /** The kind of inspection. */
  type: InspectionType;
  /** Lifecycle status. */
  status: InspectionStatus;
  /** Outcome (unset until the inspection is concluded). */
  result?: InspectionResult;
  /** Project the inspection belongs to. */
  projectId?: number;
  /** Site location. */
  location?: string;
  /** Area inspected. */
  areaInspected?: string;
  /** Drawing reference. */
  drawingReference?: string;
  /** Scheduled date (`YYYY-MM-DD`). */
  scheduledDate?: string;
  /** Scheduled time (free text, e.g. `10:00`). */
  scheduledTime?: string;
  /** Actual start timestamp (ISO string). */
  actualStartTime?: string;
  /** Actual end timestamp (ISO string). */
  actualEndTime?: string;
  /** Duration in minutes. */
  duration?: number;
  /** Inspector (employee id). */
  inspectorId: number;
  /** Contractor id. */
  contractorId?: number;
  /** Client representative present. */
  clientRepresentative?: string;
  /** Other attendees. */
  attendees: string[];
  /** Weather conditions on site. */
  weatherConditions?: string;
  /** Temperature on site (free text). */
  temperature?: string;
  /** Total number of check points (server-computed). */
  totalCheckPoints: number;
  /** Number of passed check points (server-computed). */
  passedCheckPoints: number;
  /** Number of failed check points (server-computed). */
  failedCheckPoints: number;
  /** Number of defects found (server-computed). */
  defectsFound: number;
  /**
   * How the inspection came to exist. Defaults to `MANUAL`; compliance
   * inspections produced by the AI flow are `AI_GENERATED`. Read-only.
   */
  origin: InspectionOrigin;
  /**
   * Construction-lifecycle phase the compliance applies to. Set only on
   * compliance inspections. Read-only.
   */
  compliancePhase?: CompliancePhase;
  /**
   * Risk severity of the compliance. Set only on compliance inspections.
   * Read-only.
   */
  riskLevel?: ComplianceRiskLevel;
  /**
   * Suggested ways to resolve the compliance (free text). Set only on
   * compliance inspections. Read-only.
   */
  resolutionOptions?: string;
  /**
   * Reference to the compliance rule the inspection was generated from. Set
   * only on compliance inspections. Read-only.
   */
  complianceRuleRef?: string;
  /**
   * The AI's rationale for suggesting the compliance (free text). Set only on
   * compliance inspections. Read-only.
   */
  aiRationale?: string;
  /** The check points evaluated. */
  checkItems: InspectionCheckItem[];
  /** The defects recorded. */
  defects: InspectionDefect[];
  /** Creation timestamp (ISO string). */
  createdAt?: string;
  /** Last-update timestamp (ISO string). */
  updatedAt?: string;
}

/**
 * Parses a raw inspection-check-item payload into a typed
 * {@link InspectionCheckItem}.
 */
export function parseInspectionCheckItem(json: unknown): InspectionCheckItem {
  const raw = InspectionCheckItemSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseInspectionCheckItem.id'),
    category: raw.category ?? '',
    checkPoint: raw.checkPoint ?? '',
    specification: raw.specification ?? undefined,
    status: parseCheckItemStatus(raw.status),
    remarks: raw.remarks ?? undefined,
    photosRequired: raw.photosRequired ?? false,
    photos: raw.photos ?? [],
    measurement: raw.measurement ?? undefined,
    expectedValue: raw.expectedValue ?? undefined,
    priority: raw.priority ?? undefined,
  };
}

/**
 * Parses a raw inspection-defect payload into a typed {@link InspectionDefect}.
 */
export function parseInspectionDefect(json: unknown): InspectionDefect {
  const raw = InspectionDefectSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseInspectionDefect.id'),
    category: raw.category ?? undefined,
    description: raw.description ?? '',
    severity: raw.severity ?? undefined,
    location: raw.location ?? undefined,
    photos: raw.photos ?? [],
    correctiveAction: raw.correctiveAction ?? '',
    responsibleParty: raw.responsibleParty ?? undefined,
    targetDate: raw.targetDate ?? undefined,
    status: raw.status ?? undefined,
    resolvedDate: raw.resolvedDate ?? undefined,
  };
}

/**
 * Parses a raw inspection payload into a typed {@link Inspection}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Inspection`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseInspection(json: unknown): Inspection {
  const raw = InspectionSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseInspection.id'),
    inspectionNumber: raw.inspectionNumber ?? '',
    title: raw.title ?? '',
    type: parseInspectionType(raw.type),
    status: parseInspectionStatus(raw.status),
    result: parseInspectionResult(raw.result),
    projectId: raw.projectId ?? undefined,
    location: raw.location ?? undefined,
    areaInspected: raw.areaInspected ?? undefined,
    drawingReference: raw.drawingReference ?? undefined,
    scheduledDate: raw.scheduledDate ?? undefined,
    scheduledTime: raw.scheduledTime ?? undefined,
    actualStartTime: raw.actualStartTime ?? undefined,
    actualEndTime: raw.actualEndTime ?? undefined,
    duration: raw.duration ?? undefined,
    inspectorId: raw.inspectorId,
    contractorId: raw.contractorId ?? undefined,
    clientRepresentative: raw.clientRepresentative ?? undefined,
    attendees: raw.attendees ?? [],
    weatherConditions: raw.weatherConditions ?? undefined,
    temperature: raw.temperature ?? undefined,
    totalCheckPoints: raw.totalCheckPoints ?? 0,
    passedCheckPoints: raw.passedCheckPoints ?? 0,
    failedCheckPoints: raw.failedCheckPoints ?? 0,
    defectsFound: raw.defectsFound ?? 0,
    origin: parseInspectionOrigin(raw.origin),
    compliancePhase: parseCompliancePhase(raw.compliancePhase),
    riskLevel: parseComplianceRiskLevel(raw.riskLevel),
    resolutionOptions: raw.resolutionOptions ?? undefined,
    complianceRuleRef: raw.complianceRuleRef ?? undefined,
    aiRationale: raw.aiRationale ?? undefined,
    checkItems: Array.isArray(raw.checkItems)
      ? raw.checkItems.map((item) => parseInspectionCheckItem(item))
      : [],
    defects: Array.isArray(raw.defects)
      ? raw.defects.map((defect) => parseInspectionDefect(defect))
      : [],
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

/**
 * A check-point payload on a create / update inspection request. The inspection's
 * passed, failed and total counts are derived server-side from these items.
 */
export interface InspectionCheckItemRequest {
  /** Grouping category (max 200). Required. */
  category: string;
  /** The check point (max 500). Required. */
  checkPoint: string;
  /** Specification or acceptance criterion (max 1000). */
  specification?: string;
  /** Per-check-point outcome. Required. */
  status: CheckItemStatus;
  /** Inspector remarks (max 1000). */
  remarks?: string;
  /** Whether photo evidence is required. */
  photosRequired: boolean;
  /** Attached photo references (each max 500). */
  photos?: string[];
  /** Measured value (max 200). */
  measurement?: string;
  /** Expected value (max 200). */
  expectedValue?: string;
  /** Priority (max 20, free text). */
  priority?: string;
}

/**
 * A defect payload on a create / update inspection request. The number of
 * defects feeds the inspection's `defectsFound` count, computed server-side.
 */
export interface InspectionDefectRequest {
  /** Defect category (max 200). */
  category?: string;
  /** Description of the defect (max 1000). Required. */
  description: string;
  /** Severity (max 20, free text). */
  severity?: string;
  /** Where on site the defect was found (max 300). */
  location?: string;
  /** Attached photo references (each max 500). */
  photos?: string[];
  /** Corrective action required (max 1000). Required. */
  correctiveAction: string;
  /** Party responsible for the fix (max 200). */
  responsibleParty?: string;
  /** Target resolution date (`YYYY-MM-DD`). */
  targetDate?: string;
  /** Defect status (max 20, free text). */
  status?: string;
  /** Date the defect was resolved (`YYYY-MM-DD`). */
  resolvedDate?: string;
}

/**
 * Fields for creating an inspection. Status is forced to `SCHEDULED` and the
 * result stays unset server-side, so neither is supplied here.
 */
export interface CreateInspectionRequest {
  /** Inspection title (max 200). Required. */
  title: string;
  /** The kind of inspection. Required. */
  type: InspectionType;
  /** Project the inspection belongs to. */
  projectId?: number;
  /** Site location (max 300). */
  location?: string;
  /** Area inspected (max 300). */
  areaInspected?: string;
  /** Drawing reference (max 200). */
  drawingReference?: string;
  /** Scheduled date (`YYYY-MM-DD`). Required. */
  scheduledDate: string;
  /** Scheduled time (max 20, free text). */
  scheduledTime?: string;
  /** Actual start timestamp (ISO string). */
  actualStartTime?: string;
  /** Actual end timestamp (ISO string). */
  actualEndTime?: string;
  /** Duration in minutes (>= 0). */
  duration?: number;
  /** Inspector (employee id). Required. */
  inspectorId: number;
  /** Contractor id. */
  contractorId?: number;
  /** Client representative present (max 200). */
  clientRepresentative?: string;
  /** Other attendees (each max 200). */
  attendees?: string[];
  /** Weather conditions on site (max 200). */
  weatherConditions?: string;
  /** Temperature on site (max 50, free text). */
  temperature?: string;
  /** Check points to evaluate. */
  checkItems?: InspectionCheckItemRequest[];
  /** Defects recorded. */
  defects?: InspectionDefectRequest[];
}

/**
 * Fields for updating an inspection (full replacement). Status is set directly
 * and the result is optional (set once the inspection is concluded); the summary
 * counts are recomputed from the check items and defects.
 */
export interface UpdateInspectionRequest {
  /** Inspection title (max 200). Required. */
  title: string;
  /** The kind of inspection. Required. */
  type: InspectionType;
  /** Lifecycle status. Required. */
  status: InspectionStatus;
  /** Outcome (set once concluded). */
  result?: InspectionResult;
  /** Project the inspection belongs to. */
  projectId?: number;
  /** Site location (max 300). */
  location?: string;
  /** Area inspected (max 300). */
  areaInspected?: string;
  /** Drawing reference (max 200). */
  drawingReference?: string;
  /** Scheduled date (`YYYY-MM-DD`). Required. */
  scheduledDate: string;
  /** Scheduled time (max 20, free text). */
  scheduledTime?: string;
  /** Actual start timestamp (ISO string). */
  actualStartTime?: string;
  /** Actual end timestamp (ISO string). */
  actualEndTime?: string;
  /** Duration in minutes (>= 0). */
  duration?: number;
  /** Inspector (employee id). Required. */
  inspectorId: number;
  /** Contractor id. */
  contractorId?: number;
  /** Client representative present (max 200). */
  clientRepresentative?: string;
  /** Other attendees (each max 200). */
  attendees?: string[];
  /** Weather conditions on site (max 200). */
  weatherConditions?: string;
  /** Temperature on site (max 50, free text). */
  temperature?: string;
  /** Check points to evaluate. */
  checkItems?: InspectionCheckItemRequest[];
  /** Defects recorded. */
  defects?: InspectionDefectRequest[];
}

/**
 * Serializes an {@link InspectionCheckItemRequest} into a backend check-item
 * object. Required fields are always emitted; optional inputs only when set.
 */
function inspectionCheckItemToJson(
  item: InspectionCheckItemRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    category: item.category,
    checkPoint: item.checkPoint,
    status: item.status,
    photosRequired: item.photosRequired,
  };
  if (item.specification !== undefined) json.specification = item.specification;
  if (item.remarks !== undefined) json.remarks = item.remarks;
  if (item.photos !== undefined) json.photos = item.photos;
  if (item.measurement !== undefined) json.measurement = item.measurement;
  if (item.expectedValue !== undefined) json.expectedValue = item.expectedValue;
  if (item.priority !== undefined) json.priority = item.priority;
  return json;
}

/**
 * Serializes an {@link InspectionDefectRequest} into a backend defect object.
 * Required fields are always emitted; optional inputs only when set.
 */
function inspectionDefectToJson(
  defect: InspectionDefectRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    description: defect.description,
    correctiveAction: defect.correctiveAction,
  };
  if (defect.category !== undefined) json.category = defect.category;
  if (defect.severity !== undefined) json.severity = defect.severity;
  if (defect.location !== undefined) json.location = defect.location;
  if (defect.photos !== undefined) json.photos = defect.photos;
  if (defect.responsibleParty !== undefined)
    json.responsibleParty = defect.responsibleParty;
  if (defect.targetDate !== undefined) json.targetDate = defect.targetDate;
  if (defect.status !== undefined) json.status = defect.status;
  if (defect.resolvedDate !== undefined) json.resolvedDate = defect.resolvedDate;
  return json;
}

/**
 * Emits the create / update fields shared by both request shapes onto `json`.
 * Required scalar fields are always written; optional inputs only when set.
 */
function inspectionCommonToJson(
  dto: CreateInspectionRequest | UpdateInspectionRequest,
  json: Record<string, unknown>
): void {
  json.title = dto.title;
  json.type = dto.type;
  json.scheduledDate = dto.scheduledDate;
  json.inspectorId = dto.inspectorId;
  if (dto.projectId !== undefined) json.projectId = dto.projectId;
  if (dto.location !== undefined) json.location = dto.location;
  if (dto.areaInspected !== undefined) json.areaInspected = dto.areaInspected;
  if (dto.drawingReference !== undefined)
    json.drawingReference = dto.drawingReference;
  if (dto.scheduledTime !== undefined) json.scheduledTime = dto.scheduledTime;
  if (dto.actualStartTime !== undefined)
    json.actualStartTime = dto.actualStartTime;
  if (dto.actualEndTime !== undefined) json.actualEndTime = dto.actualEndTime;
  if (dto.duration !== undefined) json.duration = dto.duration;
  if (dto.contractorId !== undefined) json.contractorId = dto.contractorId;
  if (dto.clientRepresentative !== undefined)
    json.clientRepresentative = dto.clientRepresentative;
  if (dto.attendees !== undefined) json.attendees = dto.attendees;
  if (dto.weatherConditions !== undefined)
    json.weatherConditions = dto.weatherConditions;
  if (dto.temperature !== undefined) json.temperature = dto.temperature;
  if (dto.checkItems !== undefined)
    json.checkItems = dto.checkItems.map((item) =>
      inspectionCheckItemToJson(item)
    );
  if (dto.defects !== undefined)
    json.defects = dto.defects.map((defect) => inspectionDefectToJson(defect));
}

/**
 * Serializes a {@link CreateInspectionRequest} into the backend request body.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching `CreateInspectionRequest`.
 */
export function createInspectionToJson(
  dto: CreateInspectionRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  inspectionCommonToJson(dto, json);
  return json;
}

/**
 * Serializes an {@link UpdateInspectionRequest} into the backend request body.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching `UpdateInspectionRequest`.
 */
export function updateInspectionToJson(
  dto: UpdateInspectionRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    status: dto.status,
  };
  if (dto.result !== undefined) json.result = dto.result;
  inspectionCommonToJson(dto, json);
  return json;
}
