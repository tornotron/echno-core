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

export interface Task {
  id: number;
  projectId: number;
  title: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  creator?: Employee;
  assignees?: Employee[];
  category?: WorkCategory;
  progress: number;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  status: TaskStatus;
  issues?: Issue[];
  attachments?: Attachment[];
}

export const creatorId = (task: Task): number | undefined => task.creator?.id;
export const categoryId = (task: Task): number | undefined => task.category?.id;
export const asignees = (task: Task): Employee[] | undefined => task.assignees;

/** JSON → Task */
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

/** Helper: parse DateTime (string or timestamp) */
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

/** Task → JSON */
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

/** copyWith */
export function copyTask(
  task: Task,
  updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
): Task {
  return { ...task, ...updates };
}
