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
import { Employee, parseEmployee, employeeToJson } from '../employee';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { Task, parseTask } from '../task';
import { ProjectStatus, getProjectStatus } from './project-status';
import type { Attachment } from '../attachment';
import { parseAttachment, attachmentToJson } from '../attachment';
import { parsePositiveInt } from '../../lib/utils/parse-id';

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseProject(json: any): Project {
  return {
    id: parsePositiveInt(json.id, 'parseProject.id'),
    projectName: json.projectName ?? '',
    projectAddress: json.projectAddress ?? '',
    status: getProjectStatus(json.status) ?? ProjectStatus.upcoming,
    organizationId: json.organizationId
      ? Number(json.organizationId)
      : undefined,
    projectLongitude: Number(json.projectLongitude ?? 0),
    projectLatitude: Number(json.projectLatitude ?? 0),
    startDate: parseUTCDate(json.startDate) ?? undefined,
    endDate: parseUTCDate(json.endDate) ?? undefined,
    createdAt: parseUTCDate(json.createdAt) ?? undefined,
    progress: Number(json.progress ?? 0),
    members: json.employees
      ? (json.employees as unknown[]).map((e) => parseEmployee(e))
      : [],
    tasks: json.tasks ? (json.tasks as unknown[]).map((t) => parseTask(t)) : [],
    attachments: json.attachments
      ? (json.attachments as unknown[]).map((a) => parseAttachment(a))
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
