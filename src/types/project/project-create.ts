import { ProjectStatus } from './project-status';

export interface CreateProjectRequest {
  projectName: string;
  projectAddress: string;
  description?: string;
  status?: ProjectStatus;
  projectLongitude?: number;
  projectLatitude?: number;
  organizationId?: number;
  startDate?: Date;
  endDate?: Date;
  memberIds?: number[];
}

export function createProjectToJson(
  dto: CreateProjectRequest
): Record<string, unknown> {
  return {
    projectName: dto.projectName,
    projectAddress: dto.projectAddress,
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.status !== undefined && { status: dto.status }),
    ...(dto.projectLongitude !== undefined && {
      projectLongitude: dto.projectLongitude,
    }),
    ...(dto.projectLatitude !== undefined && {
      projectLatitude: dto.projectLatitude,
    }),
    ...(dto.organizationId !== undefined && {
      organizationId: dto.organizationId,
    }),
    ...(dto.startDate !== undefined && {
      startDate: dto.startDate.toISOString(),
    }),
    ...(dto.endDate !== undefined && { endDate: dto.endDate.toISOString() }),
    ...(dto.memberIds !== undefined && { employees: dto.memberIds }),
  };
}
