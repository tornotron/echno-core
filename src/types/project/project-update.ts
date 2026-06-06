import { ProjectStatus } from './project-status';

export interface UpdateProjectRequest {
  projectName?: string;
  projectAddress?: string;
  description?: string;
  status?: ProjectStatus;
  projectLongitude?: number;
  projectLatitude?: number;
  organizationId?: number;
  startDate?: Date;
  endDate?: Date;
  memberIds?: number[];
}

export function updateProjectToJson(
  dto: UpdateProjectRequest
): Record<string, unknown> {
  return {
    ...(dto.projectName !== undefined && { projectName: dto.projectName }),
    ...(dto.projectAddress !== undefined && {
      projectAddress: dto.projectAddress,
    }),
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
