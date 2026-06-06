// types/project/project.ts
import { Employee, parseEmployee, employeeToJson } from '../employee';
import { Task, parseTask } from '../task';
import { ProjectStatus, getProjectStatus } from './project-status';
import type { Attachment } from '../attachment';
import { parseAttachment, attachmentToJson } from '../attachment';
import { parsePositiveInt } from '../../lib/utils/parse-id';

export interface Project {
  id: number;
  projectName: string;
  projectAddress: string;
  status: ProjectStatus;
  projectLongitude: number;
  projectLatitude: number;
  organizationId?: number;
  startDate?: Date;
  endDate?: Date;
  createdAt?: Date;
  progress: number;
  members: Employee[];
  tasks: Task[];
  attachments?: Attachment[];
}

/** Add member (immutable) */
export function addMember(project: Project, employee: Employee): Project {
  if (project.members.some((e) => e.id === employee.id)) {
    return project;
  }
  return {
    ...project,
    members: [...project.members, employee],
  };
}

/** Remove member (immutable) */
export function removeMember(project: Project, employee: Employee): Project {
  return {
    ...project,
    members: project.members.filter((e) => e.id !== employee.id),
  };
}

/** JSON → Project */
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
    startDate: json.startDate ? new Date(json.startDate) : undefined,
    endDate: json.endDate ? new Date(json.endDate) : undefined,
    createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
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

/** Project → JSON */
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
