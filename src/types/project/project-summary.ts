/**
 * @module project-summary
 *
 * A project as `GET /project/web/summary` lists it (`ProjectSummaryDto`):
 * every scalar of the full {@link Project}, none of its collections, plus
 * the counts the list screens render. The backend reads `progress`,
 * `memberCount` and `taskCount` for the whole page in one aggregate
 * rather than by loading each project's team and tasks, which is what
 * makes the summary worth asking for.
 */

import { z } from 'zod';
import {
  parseLocalDateTime,
  parseUTCDate,
} from '../../lib/utils/date-helpers';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableNumber,
  nullableString,
  opaque,
} from '../../lib/validation/backend-schema';
import { ProjectStatus, getProjectStatus } from './project-status';
import { ProjectType, parseProjectType } from './project-type';

const ProjectSummaryResponseSchema = z.object({
  id: opaque,
  projectName: nullableString,
  projectAddress: nullableString,
  projectCity: nullableString,
  projectState: nullableString,
  projectPostalCode: nullableString,
  status: nullableString,
  projectType: nullableString,
  projectLongitude: nullableNumber,
  projectLatitude: nullableNumber,
  startDate: backendDate,
  endDate: backendDate,
  createdAt: backendDate,
  progress: nullableNumber,
  memberCount: nullableNumber,
  taskCount: nullableNumber,
});

/**
 * A project without its collections.
 *
 * Every scalar here is also on {@link Project} with the same type. The
 * summary has no `members`, `tasks` or `attachments`; in their place it
 * carries `memberCount` and `taskCount`, so a card that shows "N members"
 * and "N tasks" reads the summary and never the arrays.
 */
export interface ProjectSummary {
  /** Unique surrogate identifier assigned by the backend. */
  id: number;
  /** Display name. */
  projectName: string;
  /** Street address of the site, as one line. */
  projectAddress: string;
  /** Town or city the site is in. Absent when not recorded. */
  projectCity?: string;
  /** Indian state or union territory the site is in. Absent when not recorded. */
  projectState?: string;
  /** Postal (PIN) code of the site. Absent when not recorded. */
  projectPostalCode?: string;
  /** Current lifecycle state. */
  status: ProjectStatus;
  /** Broad construction category, when set. */
  projectType?: ProjectType;
  /** Site longitude in decimal degrees. */
  projectLongitude: number;
  /** Site latitude in decimal degrees. */
  projectLatitude: number;
  /** Planned start date. */
  startDate?: Date;
  /** Planned completion date. */
  endDate?: Date;
  /** When the project was created. */
  createdAt?: Date;
  /** Completion progress in `[0, 100]`; the same figure the full view reports. */
  progress: number;
  /** How many employees are on the project team. */
  memberCount: number;
  /** How many tasks the project has. */
  taskCount: number;
}

/**
 * The Spring `Page` envelope `GET /project/web/summary` answers with.
 */
export interface ProjectSummaryPage {
  /** The projects on this page. */
  content: ProjectSummary[];
  /** Total projects across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** Zero-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/**
 * Parses one `ProjectSummaryDto` payload into a {@link ProjectSummary}.
 * Non-strict: unknown keys are ignored and absent scalars fall back to the
 * same defaults `parseProject` uses. Absent counts read as zero.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `ProjectSummary`.
 * @throws {Error} If `id` is not a positive integer.
 */
export function parseProjectSummary(json: unknown): ProjectSummary {
  const raw = ProjectSummaryResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseProjectSummary.id'),
    projectName: raw.projectName ?? '',
    projectAddress: raw.projectAddress ?? '',
    projectCity: raw.projectCity ?? undefined,
    projectState: raw.projectState ?? undefined,
    projectPostalCode: raw.projectPostalCode ?? undefined,
    status: getProjectStatus(raw.status ?? undefined) ?? ProjectStatus.upcoming,
    projectType: parseProjectType(raw.projectType),
    projectLongitude: Number(raw.projectLongitude ?? 0),
    projectLatitude: Number(raw.projectLatitude ?? 0),
    // Calendar dates, the same reading parseProject gives them.
    startDate: parseLocalDateTime(raw.startDate) ?? undefined,
    endDate: parseLocalDateTime(raw.endDate) ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    progress: Number(raw.progress ?? 0),
    memberCount: Number(raw.memberCount ?? 0),
    taskCount: Number(raw.taskCount ?? 0),
  };
}
