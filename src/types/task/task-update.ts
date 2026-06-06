import { TaskStatus } from './task-status';

export interface UpdateTaskRequest {
  title?: string;
  projectId?: number;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  creatorId?: number;
  categoryId?: number;
  status?: TaskStatus;
  progress?: number;
  tags?: string[];
  assigneeIds?: number[];
  priority?: string;
}

export function updateTaskToJson(
  dto: UpdateTaskRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (dto.title !== undefined) payload.title = dto.title;
  if (dto.projectId !== undefined) payload.projectId = dto.projectId;
  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.startDate !== undefined)
    payload.startDate = dto.startDate.toISOString();
  if (dto.endDate !== undefined) payload.endDate = dto.endDate.toISOString();
  if (dto.creatorId !== undefined) payload.creatorId = dto.creatorId;
  if (dto.categoryId !== undefined) payload.categoryId = dto.categoryId;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.progress !== undefined) payload.progress = dto.progress;
  if (dto.tags !== undefined) payload.tags = dto.tags;
  if (dto.assigneeIds !== undefined) payload.assigneeIds = dto.assigneeIds;
  if (dto.priority !== undefined) payload.priority = dto.priority;

  return payload;
}
