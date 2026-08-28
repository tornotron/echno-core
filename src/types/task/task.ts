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
import {
  parseLocalDateTime,
  parseUTCDate,
  toLocalDateAtMidnight,
  toLocalDateTimeString,
} from '../../lib/utils/date-helpers';
import { z } from 'zod';
import {
  nullableNumber,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

// The backend serializes date fields as ISO strings; the parsers below also
// accept millisecond timestamps, so both are allowed through here.
const dateValue = z.union([z.string(), z.number()]).nullish();

const TaskResponseSchema = z.object({
  id: opaque,
  projectId: optionalNumericId,
  title: nullableString,
  description: nullableString,
  startDate: dateValue,
  endDate: dateValue,
  creator: opaque,
  assignees: z.array(z.unknown()).nullish(),
  category: opaque,
  progress: nullableNumber,
  tags: z.array(z.unknown()).nullish(),
  createdAt: dateValue,
  updatedAt: dateValue,
  status: nullableString,
  issues: z.array(z.unknown()).nullish(),
  attachments: z.array(z.unknown()).nullish(),
});

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
export function parseTask(json: unknown): Task {
  const raw = TaskResponseSchema.parse(json);
  const id = parsePositiveInt(raw.id, 'parseTask.id');

  return {
    id,
    projectId: raw.projectId ?? 1,
    title: raw.title ?? 'Untitled Task',
    description: raw.description ?? undefined,
    startDate: parseCalendarDate(raw.startDate),
    endDate: parseCalendarDate(raw.endDate),
    creator: raw.creator ? parseEmployee(raw.creator) : undefined,
    assignees: raw.assignees
      ? raw.assignees.filter(Boolean).map((m) => parseEmployee(m))
      : [],
    category: raw.category ? parseWorkCategory(raw.category) : undefined,
    progress: Number(raw.progress ?? 0),
    tags: raw.tags ? (raw.tags.filter(Boolean) as string[]) : [],
    createdAt: parseServerInstant(raw.createdAt),
    updatedAt: parseServerInstant(raw.updatedAt),
    status: taskStatusFromString(raw.status as string),
    issues: raw.issues
      ? raw.issues.filter(Boolean).map((i) => parseIssue(i))
      : [],
    attachments: raw.attachments
      ? raw.attachments.filter(Boolean).map((a) => parseAttachment(a))
      : [],
  };
}

/**
 * Server-set instant (`createdAt`, `updatedAt`), recorded by a backend running
 * in UTC and serialized without an offset.
 *
 * This replaces a local `parseDateTime` helper that was a bare `new Date(value)`
 * and so read those timestamps as local. It was invisible to the inbound pass
 * that fixed the shared parsers, because it shadowed them inside this module.
 */
function parseServerInstant(value: unknown): Date | undefined {
  return parseUTCDate(value as string | number | null | undefined) ?? undefined;
}

/**
 * Calendar date with no time of day (`startDate`, `endDate`), written by
 * {@link createTaskToJson} with `toLocalDateAtMidnight`.
 */
function parseCalendarDate(value: unknown): Date | undefined {
  return (
    parseLocalDateTime(value as string | number | null | undefined) ?? undefined
  );
}

/**
 * Serializes a {@link Task} into a JSON payload suitable for the backend.
 *
 * `startDate` and `endDate` are emitted as local calendar dates and the two
 * timestamps as naive local date-times, neither carrying an offset, which is
 * what the backend's `LocalDateTime` columns accept. Nested entities use
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
    startDate: task.startDate && toLocalDateAtMidnight(task.startDate),
    endDate: task.endDate && toLocalDateAtMidnight(task.endDate),
    creator: task.creator ? employeeToJson(task.creator) : undefined,
    assignees: task.assignees?.map((e) => employeeToJson(e)),
    category: task.category ? workCategoryToJson(task.category) : undefined,
    progress: task.progress,
    tags: task.tags ?? [],
    createdAt: task.createdAt && toLocalDateTimeString(task.createdAt),
    updatedAt: task.updatedAt && toLocalDateTimeString(task.updatedAt),
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
