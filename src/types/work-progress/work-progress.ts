/**
 * @module work-progress
 *
 * Domain types for the Work Progress module (`MODULE_WORK_PROGRESS`):
 * progress inspections of schedule activities, their request shape and
 * the parsers.
 *
 * A progress inspection records whether an activity was done, partly done
 * (with a percent) or not done on the inspection date, with the actual
 * dates, a forecast finish and the reason for any delay. It is final once
 * saved and is applied to the activity at once; planned dates and other
 * activities never change because of it. Evidence goes through the
 * platform's presigned upload path keyed on the inspection's UUID.
 *
 * The parsers are non-strict: a field the backend adds later never breaks
 * this client.
 */

import { z } from 'zod';
import {
  backendDate,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';

/** What the inspector found. */
export enum ProgressOutcome {
  /** Finished: 100 percent, with an actual finish date. */
  DONE = 'DONE',
  /** Work has happened, not finished: above 0 and below 100 percent. */
  PARTIAL = 'PARTIAL',
  /** No work done yet. */
  NOT_DONE = 'NOT_DONE',
}

/** Why an activity is behind its planned finish. */
export enum DelayReason {
  WEATHER = 'WEATHER',
  MATERIAL = 'MATERIAL',
  LABOUR = 'LABOUR',
  EQUIPMENT = 'EQUIPMENT',
  DESIGN_CHANGE = 'DESIGN_CHANGE',
  CLIENT = 'CLIENT',
  SUBCONTRACTOR = 'SUBCONTRACTOR',
  OTHER = 'OTHER',
}

/** One progress inspection as recorded. Dates are ISO `YYYY-MM-DD`. */
export interface ProgressInspection {
  /** UUID of the record. */
  id: string;
  projectId: number;
  wbsElementId: number;
  wbsCode: string;
  activityTitle: string;
  inspectionDate: string;
  outcome: ProgressOutcome;
  /** Cumulative percent complete, 0 to 100. */
  percentComplete: number;
  actualStartDate?: string;
  actualFinishDate?: string;
  forecastFinishDate?: string;
  /** The planned finish when this was recorded. */
  plannedFinishDate?: string;
  /** Days behind the planned finish when recorded; absent with no planned finish. */
  delayDays?: number;
  delayReason?: DelayReason;
  delayNotes?: string;
  spatialNodeId?: string;
  remarks?: string;
  inspectorEmployeeId?: number;
  inspectorName?: string;
  createdAt?: string;
}

/** Body of `POST /progress-inspections/web`. */
export interface RecordProgressInspectionRequest {
  wbsElementId: number;
  /** Not in the future. */
  inspectionDate: string;
  outcome: ProgressOutcome;
  /** Required for PARTIAL; DONE is 100 and NOT_DONE is 0. */
  percentComplete?: number;
  /** Needed for DONE and PARTIAL unless the activity already has one. */
  actualStartDate?: string;
  /** Needed for DONE, refused otherwise. */
  actualFinishDate?: string;
  forecastFinishDate?: string;
  /** Required when the activity is behind its planned finish. */
  delayReason?: DelayReason;
  /** Required when the reason is OTHER. */
  delayNotes?: string;
  spatialNodeId?: string;
  remarks?: string;
}

/** Query parameters of `GET /progress-inspections/web`. */
export interface ProgressInspectionListParams {
  projectId?: number;
  wbsElementId?: number;
  /** 0-based page index. */
  pageNo?: number;
  pageSize?: number;
}

/** A page of progress inspections. */
export interface ProgressInspectionPage {
  content: ProgressInspection[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const numeric = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]);

const ProgressInspectionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  projectId: numeric.nullish(),
  wbsElementId: numeric.nullish(),
  wbsCode: nullableString,
  activityTitle: nullableString,
  inspectionDate: nullableString,
  outcome: nullableString,
  percentComplete: z.coerce.number().nullish(),
  actualStartDate: backendDate,
  actualFinishDate: backendDate,
  forecastFinishDate: backendDate,
  plannedFinishDate: backendDate,
  delayDays: nullableNumber,
  delayReason: nullableString,
  delayNotes: nullableString,
  spatialNodeId: nullableString,
  remarks: nullableString,
  inspectorEmployeeId: numeric.nullish(),
  inspectorName: nullableString,
  createdAt: backendDate,
});

const ProgressInspectionPageSchema = z.object({
  content: z.array(z.unknown()).nullish(),
  page: nullableNumber,
  number: nullableNumber,
  size: nullableNumber,
  totalElements: nullableNumber,
  totalPages: nullableNumber,
});

function parseOutcome(raw: string | null | undefined): ProgressOutcome {
  return Object.values(ProgressOutcome).includes(raw as ProgressOutcome)
    ? (raw as ProgressOutcome)
    : ProgressOutcome.PARTIAL;
}

function parseDelayReason(raw: string | null | undefined): DelayReason | undefined {
  if (!raw) return undefined;
  return Object.values(DelayReason).includes(raw as DelayReason)
    ? (raw as DelayReason)
    : DelayReason.OTHER;
}

/**
 * Parses one progress inspection. Only `id` is required. An unknown delay
 * reason reads as OTHER, so a reason the backend adds later still shows.
 *
 * @throws {Error} If `id` is missing.
 */
export function parseProgressInspection(json: unknown): ProgressInspection {
  const raw = ProgressInspectionSchema.parse(json);
  return {
    id: String(raw.id),
    projectId: raw.projectId ?? 0,
    wbsElementId: raw.wbsElementId ?? 0,
    wbsCode: raw.wbsCode ?? '',
    activityTitle: raw.activityTitle ?? '',
    inspectionDate: raw.inspectionDate ?? '',
    outcome: parseOutcome(raw.outcome),
    percentComplete: raw.percentComplete ?? 0,
    actualStartDate: raw.actualStartDate ?? undefined,
    actualFinishDate: raw.actualFinishDate ?? undefined,
    forecastFinishDate: raw.forecastFinishDate ?? undefined,
    plannedFinishDate: raw.plannedFinishDate ?? undefined,
    delayDays: raw.delayDays ?? undefined,
    delayReason: parseDelayReason(raw.delayReason),
    delayNotes: raw.delayNotes ?? undefined,
    spatialNodeId: raw.spatialNodeId ?? undefined,
    remarks: raw.remarks ?? undefined,
    inspectorEmployeeId: raw.inspectorEmployeeId ?? undefined,
    inspectorName: raw.inspectorName ?? undefined,
    createdAt: raw.createdAt ?? undefined,
  };
}

/** Parses a Spring-style page. Accepts `page` or `number` for the index. */
export function parseProgressInspectionPage(json: unknown): ProgressInspectionPage {
  const raw = ProgressInspectionPageSchema.parse(json);
  const content = (raw.content ?? []).map(parseProgressInspection);
  return {
    content,
    page: raw.page ?? raw.number ?? 0,
    size: raw.size ?? content.length,
    totalElements: raw.totalElements ?? content.length,
    totalPages: raw.totalPages ?? (content.length > 0 ? 1 : 0),
  };
}
