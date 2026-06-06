/**
 * @module task
 *
 * Core {@link Task} domain entity plus its JSON parser, JSON serializer,
 * accessor helpers, and a `copyWith`-style updater.
 *
 * The parser tolerates partial backend payloads (`TaskSimpleDto` omits
 * `creator`, `assignees`, `category`, `issues`, and `attachments`);
 * absent fields parse as `undefined` or empty arrays. Callers that
 * maintain a long-lived detail cache should merge a `SimpleDto` response
 * with `mergePreservingNested` (from `../../lib/query/cache-merge`)
 * rather than overwriting.
 */
// types/task/task.ts
import { Employee, parseEmployee, employeeToJson } from '../employee';
import { Issue, issueToJson, parseIssue } from '../issue';
import {
  WorkCategory,
  parseWorkCategory,
  workCategoryToJson,
} from '../work-category/work-category';
import { TaskStatus, taskStatusFromString } from './task-status';
import { Attachment, parseAttachment } from '../attachment';
import { parsePositiveInt } from '../../lib/utils/parse-id';

/**
 * A unit of work belonging to a {@link Project}.
 *
 * Nested fields (`creator`, `assignees`, `category`, `issues`,
 * `attachments`) populate from full-DTO endpoints (`GET /tasks/web`,
 * `GET /tasks/web/{id}`); the Simple-DTO endpoints (`POST`, `PATCH`)
 * leave them empty so callers must merge with cached state instead of
 * overwriting.
 */
export interface Task {
  /** Unique surrogate identifier. */
  id: number;

  /** Surrogate ID of the owning {@link Project}. */
  projectId: number;

  /** Display title. */
  title: string;

  /** Free-text description. */
  description?: string;

  /** Planned start date. */
  startDate?: Date;

  /** Planned end date. */
  endDate?: Date;

  /** Employee who created the task. Absent on `TaskSimpleDto` responses. */
  creator?: Employee;

  /** Employees assigned to the task. Absent on `TaskSimpleDto` responses. */
  assignees?: Employee[];

  /** Work category classification. Absent on `TaskSimpleDto` responses. */
  category?: WorkCategory;

  /** Completion progress as a number in `[0, 100]`. */
  progress: number;

  /** Free-form labels. */
  tags?: string[];

  /** Creation timestamp recorded by the backend. */
  createdAt?: Date;

  /** Last-modified timestamp recorded by the backend. */
  updatedAt?: Date;

  /** Current lifecycle state. */
  status: TaskStatus;

  /** Issues filed against the task. Absent on `TaskSimpleDto` responses. */
  issues?: Issue[];

  /** Attachments uploaded against the task. Absent on `TaskSimpleDto` responses. */
  attachments?: Attachment[];
}

/** Returns the creator's surrogate ID, or `undefined` when no creator is attached. */
export const creatorId = (task: Task): number | undefined => task.creator?.id;

/** Returns the work-category ID, or `undefined` when no category is attached. */
export const categoryId = (task: Task): number | undefined => task.category?.id;

/** Returns the assignee list, or `undefined` when no assignees are attached. */
export const asignees = (task: Task): Employee[] | undefined => task.assignees;

/**
 * Parses a raw backend payload into a typed {@link Task}.
 *
 * Tolerates partial responses (`TaskSimpleDto`): missing joined entities
 * (`creator`, `category`) stay `undefined`; missing collections
 * (`assignees`, `issues`, `attachments`, `tags`) become empty arrays;
 * missing numeric fields default to `0`.
 *
 * @param json - The raw JSON object returned by the backend.
 * @returns A validated `Task` domain object.
 * @throws {Error} If `json.id` is missing or not a positive integer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseTask(json: any): Task {
  const id = parsePositiveInt(json.id, 'parseTask.id');

  return {
    id,
    projectId: json.projectId ?? 1,
    title: json.title ?? 'Untitled Task',
    description: json.description ?? undefined,
    startDate: parseDateTime(json.startDate),
    endDate: parseDateTime(json.endDate),
    creator: json.creator ? parseEmployee(json.creator) : undefined,
    assignees: json.assignees
      ? (json.assignees as unknown[])
          .filter(Boolean)
          .map((m) => parseEmployee(m))
      : [],
    category: json.category ? parseWorkCategory(json.category) : undefined,
    progress: Number(json.progress ?? 0),
    tags: json.tags
      ? ((json.tags as unknown[]).filter(Boolean) as string[])
      : [],
    createdAt: parseDateTime(json.createdAt),
    updatedAt: parseDateTime(json.updatedAt),
    status: taskStatusFromString(json.status),
    issues: json.issues
      ? (json.issues as unknown[]).filter(Boolean).map((i) => parseIssue(i))
      : [],
    attachments: json.attachments
      ? (json.attachments as unknown[])
          .filter(Boolean)
          .map((a) => parseAttachment(a))
      : [],
  };
}

/** Tolerant `Date` parser: accepts ISO strings or millisecond timestamps. */
function parseDateTime(value: unknown): Date | undefined {
  if (!value) return undefined;
  try {
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'number') return new Date(value);
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Serializes a {@link Task} into a JSON payload suitable for the backend.
 *
 * `Date` fields are emitted as ISO-8601 strings; nested entities use
 * their own serializers (`employeeToJson`, `workCategoryToJson`,
 * `issueToJson`).
 *
 * @param task - The domain task to serialize.
 * @returns A plain object matching the backend's expected shape.
 */
export function taskToJson(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    startDate: task.startDate?.toISOString(),
    endDate: task.endDate?.toISOString(),
    creator: task.creator ? employeeToJson(task.creator) : undefined,
    assignees: task.assignees?.map((e) => employeeToJson(e)),
    category: task.category ? workCategoryToJson(task.category) : undefined,
    progress: task.progress,
    tags: task.tags ?? [],
    createdAt: task.createdAt?.toISOString(),
    updatedAt: task.updatedAt?.toISOString(),
    status: task.status,
    issues: task.issues?.map((i) => issueToJson(i)) ?? [],
  };
}

/**
 * Returns a new {@link Task} with the provided field overrides applied.
 *
 * `id`, `createdAt`, and `updatedAt` are immutable and excluded from
 * the overrides type. Pure / immutable — the input task is not mutated.
 *
 * @param task - The task to clone.
 * @param updates - Partial overrides for the cloned task's fields.
 * @returns A new task value with the overrides merged in.
 */
export function copyTask(
  task: Task,
  updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
): Task {
  return { ...task, ...updates };
}
