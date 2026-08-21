/**
 * @module project
 *
 * Core {@link Project} domain entity plus its JSON parser, JSON
 * serializer, and immutable member-list helpers.
 *
 * The parser tolerates partial backend payloads (`ProjectSimpleDto`
 * omits `attachments`, `members`, and `tasks`); fields that are absent
 * are returned as empty arrays or `undefined`. See `mergePreservingNested`
 * (from `../../lib/query/cache-merge`) for the caller-side strategy that
 * preserves cached nested arrays across a partial response.
 */
// types/project/project.ts
import { z } from 'zod';
import { Employee, parseEmployee, employeeToJson } from '../employee';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { Task, parseTask } from '../task';
import { ProjectStatus, getProjectStatus } from './project-status';
import { ProjectType, parseProjectType } from './project-type';
import type { Attachment } from '../attachment';
import { parseAttachment, attachmentToJson } from '../attachment';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableNumber,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

/**
 * A construction project tracked by Echno.
 *
 * Nested collections (`members`, `tasks`, `attachments`) populate from
 * full-DTO endpoints (`GET /project/web`, `GET /project/web/{id}`); the
 * Simple-DTO endpoints (`POST`, `PATCH`) leave them empty so callers
 * must merge with cached state instead of overwriting.
 */
export interface Project {
  /** Unique surrogate identifier assigned by the backend. */
  id: number;

  /** Display name. */
  projectName: string;

  /** Site address. */
  projectAddress: string;

  /** Current lifecycle state. */
  status: ProjectStatus;

  /**
   * Broad construction category, when set. Drives which statutory compliances
   * the AI generation flow considers.
   */
  projectType?: ProjectType;

  /** Site longitude in decimal degrees. */
  projectLongitude: number;

  /** Site latitude in decimal degrees. */
  projectLatitude: number;

  /** Owning organization, when known. */
  organizationId?: number;

  /** Planned start date. */
  startDate?: Date;

  /** Planned end date. */
  endDate?: Date;

  /** Creation timestamp recorded by the backend. */
  createdAt?: Date;

  /** Completion progress as a number in `[0, 100]`. */
  progress: number;

  /**
   * Employees currently assigned as members. Empty on `ProjectSimpleDto`
   * responses; full on detail / list queries.
   */
  members: Employee[];

  /**
   * Tasks belonging to the project. Empty on `ProjectSimpleDto`
   * responses; full on detail queries.
   */
  tasks: Task[];

  /**
   * Attachments uploaded against the project. `undefined` on
   * `ProjectSimpleDto` responses; populated on detail queries.
   */
  attachments?: Attachment[];
}

/**
 * Returns a new {@link Project} with `employee` added to `members`.
 *
 * No-op if the employee is already a member. Pure / immutable — the
 * input project is not mutated.
 *
 * @param project - The project to update.
 * @param employee - The employee to add.
 * @returns A new project value with the updated member list.
 */
export function addMember(project: Project, employee: Employee): Project {
  if (project.members.some((e) => e.id === employee.id)) {
    return project;
  }
  return {
    ...project,
    members: [...project.members, employee],
  };
}

/**
 * Returns a new {@link Project} with `employee` removed from `members`.
 *
 * Pure / immutable — the input project is not mutated.
 *
 * @param project - The project to update.
 * @param employee - The employee to remove.
 * @returns A new project value with the updated member list.
 */
export function removeMember(project: Project, employee: Employee): Project {
  return {
    ...project,
    members: project.members.filter((e) => e.id !== employee.id),
  };
}

const ProjectResponseSchema = z.object({
  id: opaque,
  projectName: nullableString,
  projectAddress: nullableString,
  status: nullableString,
  projectType: nullableString,
  organizationId: optionalNumericId,
  projectLongitude: nullableNumber,
  projectLatitude: nullableNumber,
  startDate: backendDate,
  endDate: backendDate,
  createdAt: backendDate,
  progress: nullableNumber,
  employees: z.array(z.unknown()).nullish(),
  tasks: z.array(z.unknown()).nullish(),
  attachments: z.array(z.unknown()).nullish(),
});

/**
 * Parses a raw backend payload into a typed {@link Project}.
 *
 * Tolerates partial responses (`ProjectSimpleDto`): missing
 * `employees` / `tasks` produce empty arrays; missing `attachments`
 * stays `undefined`; missing numeric fields default to `0`.
 *
 * @param json - The raw JSON object returned by the backend.
 * @returns A validated `Project` domain object.
 * @throws {Error} If `json.id` is missing or not a positive integer.
 */
export function parseProject(json: unknown): Project {
  const raw = ProjectResponseSchema.parse(json);

  return {
    id: parsePositiveInt(raw.id, 'parseProject.id'),
    projectName: raw.projectName ?? '',
    projectAddress: raw.projectAddress ?? '',
    status: getProjectStatus(raw.status ?? undefined) ?? ProjectStatus.upcoming,
    projectType: parseProjectType(raw.projectType),
    organizationId: raw.organizationId
      ? Number(raw.organizationId)
      : undefined,
    projectLongitude: Number(raw.projectLongitude ?? 0),
    projectLatitude: Number(raw.projectLatitude ?? 0),
    startDate: parseUTCDate(raw.startDate) ?? undefined,
    endDate: parseUTCDate(raw.endDate) ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    progress: Number(raw.progress ?? 0),
    members: raw.employees
      ? (raw.employees as unknown[]).map((e) => parseEmployee(e))
      : [],
    tasks: raw.tasks ? (raw.tasks as unknown[]).map((t) => parseTask(t)) : [],
    attachments: raw.attachments
      ? (raw.attachments as unknown[]).map((a) => parseAttachment(a))
      : undefined,
  };
}

/**
 * Serializes a {@link Project} into a JSON payload suitable for the
 * backend update endpoints.
 *
 * `members` is renamed to `employees`; `Date` fields are emitted as
 * ISO-8601 strings; `tasks` is intentionally omitted because the
 * backend does not accept task arrays on project update.
 *
 * @param project - The domain project to serialize.
 * @returns A plain object matching the backend's expected shape.
 */
export function projectToJson(project: Project): Record<string, unknown> {
  return {
    id: project.id,
    organizationId: project.organizationId,
    projectName: project.projectName,
    projectAddress: project.projectAddress,
    status: project.status,
    projectType: project.projectType,
    projectLongitude: project.projectLongitude,
    projectLatitude: project.projectLatitude,
    startDate: project.startDate?.toISOString(),
    endDate: project.endDate?.toISOString(),
    employees: project.members.map((e) => employeeToJson(e)),
    createdAt: project.createdAt?.toISOString(),
    attachments: project.attachments
      ? project.attachments.map((a) => attachmentToJson(a))
      : undefined,
    // tasks are not sent in update
  };
}
