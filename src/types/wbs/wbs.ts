/**
 * @module wbs
 *
 * Domain types for a project's schedule: the WBS elements as schedule
 * activities (planned, actual and forecast dates, milestone flag,
 * responsible party, delay) and the dependency links between them, with
 * the request shapes and the parsers that turn raw payloads into them.
 *
 * The backend never moves a planned date on its own. A delay is recorded
 * as a forecast finish, and `delayDays` is worked out against the planned
 * finish (`endDate`). Dependencies are information: nothing is rescheduled
 * because of them.
 *
 * The parsers are non-strict: a field the backend adds later never breaks
 * this client.
 */

import { z } from 'zod';
import {
  backendDate,
  nullableBoolean,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';

/** Where an activity stands. */
export enum WbsStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

/** How a successor is tied to its predecessor. */
export enum WbsDependencyType {
  /** Finish-to-start, the default. */
  FS = 'FS',
  /** Start-to-start. */
  SS = 'SS',
  /** Finish-to-finish. */
  FF = 'FF',
  /** Start-to-finish. */
  SF = 'SF',
}

/** One WBS element as a schedule row. Dates are ISO `YYYY-MM-DD`. */
export interface WbsActivity {
  id: number;
  wbsCode: string;
  title: string;
  description?: string;
  /** Depth in the tree, 0 for a root. */
  level: number;
  sortOrder: number;
  status: WbsStatus;
  /** Planned start. */
  startDate?: string;
  /** Planned finish: the agreed date a delay is measured against. */
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  /** Revised finish once the activity is known to be late. */
  forecastEndDate?: string;
  /** Percent complete, 0 to 100; rolled up from children on a parent. */
  progress: number;
  weight: number;
  budgetedCost: number;
  actualCost: number;
  /** A leaf is an activity progress is recorded against. */
  isLeaf: boolean;
  isMilestone: boolean;
  parentId?: number;
  projectId?: number;
  responsibleEmployeeId?: number;
  responsibleEmployeeName?: string;
  responsibleSubContractId?: number;
  responsibleSubContractorName?: string;
  /**
   * Days behind the planned finish; 0 when on time, absent when there is
   * no planned finish.
   */
  delayDays?: number;
}

/** A link between two activities of one project. */
export interface WbsDependency {
  id: number;
  predecessorId: number;
  predecessorWbsCode: string;
  successorId: number;
  successorWbsCode: string;
  type: WbsDependencyType;
  /** Lag in days; negative for a lead. */
  lagDays: number;
}

/** A project's schedule in one read. */
export interface WbsSchedule {
  /** Every element, ordered by `wbsCode`. */
  activities: WbsActivity[];
  dependencies: WbsDependency[];
}

/** Body of `POST /project/{projectId}/wbs/web`. */
export interface CreateWbsActivityRequest {
  wbsCode: string;
  title: string;
  description?: string;
  parentId?: number;
  sortOrder?: number;
  startDate?: string;
  endDate?: string;
  budgetedCost?: number;
  weight?: number;
  isMilestone?: boolean;
  responsibleEmployeeId?: number;
  responsibleSubContractId?: number;
}

/**
 * Body of `PUT /project/{projectId}/wbs/web/{elementId}`: a partial
 * update; only the fields present change.
 */
export interface UpdateWbsActivityRequest {
  title?: string;
  description?: string;
  status?: WbsStatus;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  forecastEndDate?: string;
  budgetedCost?: number;
  weight?: number;
  sortOrder?: number;
  isMilestone?: boolean;
  responsibleEmployeeId?: number;
  responsibleSubContractId?: number;
}

/** Body of `POST /project/{projectId}/wbs/web/dependencies`. */
export interface CreateWbsDependencyRequest {
  predecessorId: number;
  successorId: number;
  /** Defaults to FS on the backend. */
  type?: WbsDependencyType;
  /** Defaults to 0. */
  lagDays?: number;
}

const id = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]);
const optionalId = id.nullish();

const WbsActivitySchema = z.object({
  id,
  wbsCode: nullableString,
  title: nullableString,
  description: nullableString,
  level: nullableNumber,
  sortOrder: nullableNumber,
  status: nullableString,
  startDate: backendDate,
  endDate: backendDate,
  actualStartDate: backendDate,
  actualEndDate: backendDate,
  forecastEndDate: backendDate,
  progress: nullableNumber,
  weight: nullableNumber,
  budgetedCost: z.coerce.number().nullish(),
  actualCost: z.coerce.number().nullish(),
  isLeaf: nullableBoolean,
  isMilestone: nullableBoolean,
  parentId: optionalId,
  projectId: optionalId,
  responsibleEmployeeId: optionalId,
  responsibleEmployeeName: nullableString,
  responsibleSubContractId: optionalId,
  responsibleSubContractorName: nullableString,
  delayDays: nullableNumber,
});

const WbsDependencySchema = z.object({
  id,
  predecessorId: id,
  predecessorWbsCode: nullableString,
  successorId: id,
  successorWbsCode: nullableString,
  type: nullableString,
  lagDays: nullableNumber,
});

const WbsScheduleSchema = z.object({
  activities: z.array(z.unknown()).nullish(),
  dependencies: z.array(z.unknown()).nullish(),
});

function parseStatus(raw: string | null | undefined): WbsStatus {
  return Object.values(WbsStatus).includes(raw as WbsStatus)
    ? (raw as WbsStatus)
    : WbsStatus.NOT_STARTED;
}

function parseDependencyType(raw: string | null | undefined): WbsDependencyType {
  return Object.values(WbsDependencyType).includes(raw as WbsDependencyType)
    ? (raw as WbsDependencyType)
    : WbsDependencyType.FS;
}

/**
 * Parses one WBS element. Only `id` is required; an unknown status reads
 * as not started.
 *
 * @throws {Error} If `id` is missing.
 */
export function parseWbsActivity(json: unknown): WbsActivity {
  const raw = WbsActivitySchema.parse(json);
  return {
    id: raw.id,
    wbsCode: raw.wbsCode ?? '',
    title: raw.title ?? '',
    description: raw.description ?? undefined,
    level: raw.level ?? 0,
    sortOrder: raw.sortOrder ?? 0,
    status: parseStatus(raw.status),
    startDate: raw.startDate ?? undefined,
    endDate: raw.endDate ?? undefined,
    actualStartDate: raw.actualStartDate ?? undefined,
    actualEndDate: raw.actualEndDate ?? undefined,
    forecastEndDate: raw.forecastEndDate ?? undefined,
    progress: raw.progress ?? 0,
    weight: raw.weight ?? 1,
    budgetedCost: raw.budgetedCost ?? 0,
    actualCost: raw.actualCost ?? 0,
    isLeaf: raw.isLeaf ?? true,
    isMilestone: raw.isMilestone ?? false,
    parentId: raw.parentId ?? undefined,
    projectId: raw.projectId ?? undefined,
    responsibleEmployeeId: raw.responsibleEmployeeId ?? undefined,
    responsibleEmployeeName: raw.responsibleEmployeeName ?? undefined,
    responsibleSubContractId: raw.responsibleSubContractId ?? undefined,
    responsibleSubContractorName: raw.responsibleSubContractorName ?? undefined,
    delayDays: raw.delayDays ?? undefined,
  };
}

/**
 * Parses one dependency link. An unknown type reads as finish-to-start.
 *
 * @throws {Error} If an id is missing.
 */
export function parseWbsDependency(json: unknown): WbsDependency {
  const raw = WbsDependencySchema.parse(json);
  return {
    id: raw.id,
    predecessorId: raw.predecessorId,
    predecessorWbsCode: raw.predecessorWbsCode ?? '',
    successorId: raw.successorId,
    successorWbsCode: raw.successorWbsCode ?? '',
    type: parseDependencyType(raw.type),
    lagDays: raw.lagDays ?? 0,
  };
}

/** Parses the schedule read. A malformed row fails the whole parse. */
export function parseWbsSchedule(json: unknown): WbsSchedule {
  const raw = WbsScheduleSchema.parse(json);
  return {
    activities: (raw.activities ?? []).map(parseWbsActivity),
    dependencies: (raw.dependencies ?? []).map(parseWbsDependency),
  };
}
