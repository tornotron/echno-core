import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { Project, parseProject } from '../types/project/project';
import { Employee, parseEmployee } from '../types/employee';
import {
  CreateProjectRequest,
  createProjectToJson,
  UpdateProjectRequest,
  updateProjectToJson,
  ProjectFiles,
} from '../types/project';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/**
 * Backend response shape audit (per local-docs/backend-api-docs.md):
 *
 *   GET    /project/web                                       → ProjectDto[]      (full)
 *   GET    /project/web/{id}                                  → ProjectDto        (full)
 *   GET    /project/web/employees/{employeeId}                → ProjectDto[]      (full)
 *   POST   /project/web                                       → ProjectSimpleDto  (partial — no nested)
 *   PATCH  /project/web/{id}                                  → ProjectSimpleDto  (partial — no nested)
 *   DELETE /project/web/{id}                                  → ApiResponse      (ack only)
 *   POST   /project/web/{projectId}/employees/{employeeId}    → EmployeeDto      (the added Employee, not a Project)
 *   DELETE /project/web/{projectId}/employees/{employeeId}    → ApiResponse      (ack only)
 *   GET    /project/web/{projectId}/employees                 → EmployeeDto[]
 *
 * `create`, `createWithFiles`, `update`, `updateWithFiles` parse a
 * ProjectSimpleDto with `parseProject`, which tolerates missing fields by
 * setting them to undefined/empty. The returned Project therefore lacks
 * populated `attachments`, `members`, and `tasks`. Callers must NEVER overwrite
 * the cached detail entry with this response — use `mergePreservingNested`
 * from `@tornotron/echno-core` and invalidate the detail key to refetch the
 * full object.
 */
function safeParseProject(data: ApiResponse): Project {
  try {
    return parseProject(data);
  } catch (error) {
    logger.error('Failed to parse project data:', error);
    throw new ApiError(
      'Failed to process project data. Please try again.',
      422
    );
  }
}

function safeParseProjects(data: ApiResponse[]): Project[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseProject(item));
  } catch (error) {
    logger.error('Failed to parse projects data:', error);
    throw new ApiError(
      'Failed to process projects data. Please try again.',
      422
    );
  }
}

function safeParseEmployees(data: ApiResponse[]): Employee[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseEmployee(item));
  } catch (error) {
    logger.error('Failed to parse employees data:', error);
    throw new ApiError(
      'Failed to process employees data. Please try again.',
      422
    );
  }
}

export const projectService = {
  async getAll(): Promise<Project[]> {
    const data = await api.get<ApiResponse[]>('/project/web');
    return safeParseProjects(data);
  },

  async getById(id: number): Promise<Project> {
    const data = await api.get<ApiResponse>(`/project/web/${id}`);
    return safeParseProject(data);
  },

  async getByOrganization(organizationId: number): Promise<Project[]> {
    const data = await api.get<ApiResponse[]>(
      `/project/web/organization/${organizationId}`
    );
    return safeParseProjects(data);
  },

  async create(dto: CreateProjectRequest): Promise<Project> {
    const data = await api.post<ApiResponse>(
      '/project/web',
      createProjectToJson(dto)
    );
    return safeParseProject(data);
  },

  async createWithFiles(
    dto: CreateProjectRequest,
    files: ProjectFiles
  ): Promise<Project> {
    const payload = createProjectToJson(dto);
    const hasFiles = files.attachments && files.attachments.length > 0;
    if (!hasFiles) payload.attachments = [];
    const data = await api.postMultipart<ApiResponse>(
      '/project/web',
      payload,
      hasFiles ? { attachments: files.attachments! } : undefined
    );
    return safeParseProject(data);
  },

  async update(id: number, dto: UpdateProjectRequest): Promise<Project> {
    const data = await api.patch<ApiResponse>(
      `/project/web/${id}`,
      updateProjectToJson(dto)
    );
    return safeParseProject(data);
  },

  async updateWithFiles(
    id: number,
    dto: UpdateProjectRequest,
    files: ProjectFiles
  ): Promise<Project> {
    const payload = updateProjectToJson(dto);
    const hasFiles = files.attachments && files.attachments.length > 0;
    if (!hasFiles) payload.attachments = [];
    const data = await api.patchMultipart<ApiResponse>(
      `/project/web/${id}`,
      payload,
      hasFiles ? { attachments: files.attachments! } : undefined
    );
    return safeParseProject(data);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/project/web/${id}`);
  },

  async addEmployee(projectId: number, employeeId: number): Promise<void> {
    await api.post(`/project/web/${projectId}/employees/${employeeId}`, {});
  },

  async removeEmployee(projectId: number, employeeId: number): Promise<void> {
    await api.delete(`/project/web/${projectId}/employees/${employeeId}`);
  },

  async getProjectsByEmployee(employeeId: number): Promise<Project[]> {
    const data = await api.get<ApiResponse[]>(
      `/project/web/employees/${employeeId}`
    );
    return safeParseProjects(data);
  },

  async getEmployeesByProject(projectId: number): Promise<Employee[]> {
    const data = await api.get<ApiResponse[]>(
      `/project/web/${projectId}/employees`
    );
    return safeParseEmployees(data);
  },
};
