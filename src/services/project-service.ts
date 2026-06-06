/**
 * @module project-service
 *
 * Typed client for the project-management backend endpoints under
 * `/project/web`. Wraps `api.*` calls and parses raw JSON into
 * strongly-typed {@link Project} and {@link Employee} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */
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
  /**
   * Fetches every project visible to the current user.
   *
   * `GET /project/web` → `ProjectDto[]` (full — nested arrays populated).
   *
   * @returns A resolved array of {@link Project} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAll(): Promise<Project[]> {
    const data = await api.get<ApiResponse[]>('/project/web');
    return safeParseProjects(data);
  },

  /**
   * Fetches a single project by ID.
   *
   * `GET /project/web/{id}` → `ProjectDto` (full).
   *
   * @param id - Surrogate ID of the project.
   * @returns The resolved {@link Project}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getById(id: number): Promise<Project> {
    const data = await api.get<ApiResponse>(`/project/web/${id}`);
    return safeParseProject(data);
  },

  /**
   * Fetches every project under the given organization.
   *
   * `GET /project/web/organization/{organizationId}` → `ProjectDto[]` (full).
   *
   * @param organizationId - Surrogate ID of the organization.
   * @returns A resolved array of {@link Project} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getByOrganization(organizationId: number): Promise<Project[]> {
    const data = await api.get<ApiResponse[]>(
      `/project/web/organization/${organizationId}`
    );
    return safeParseProjects(data);
  },

  /**
   * Creates a new project without file uploads.
   *
   * `POST /project/web` → `ProjectSimpleDto` (partial — `attachments`,
   * `members`, and `tasks` absent).
   *
   * @param dto - Domain create request.
   * @returns The created {@link Project}. Nested arrays are empty;
   *   callers that already cache project detail must refetch or merge.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async create(dto: CreateProjectRequest): Promise<Project> {
    const data = await api.post<ApiResponse>(
      '/project/web',
      createProjectToJson(dto)
    );
    return safeParseProject(data);
  },

  /**
   * Creates a new project with attachment uploads in a single multipart
   * request.
   *
   * `POST /project/web` (multipart) → `ProjectSimpleDto` (partial).
   *
   * If `files.attachments` is empty, an empty `attachments` field is sent
   * to instruct the backend that no files were uploaded.
   *
   * @param dto - Domain create request.
   * @param files - Files to upload alongside the request.
   * @returns The created {@link Project} with empty nested arrays.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
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

  /**
   * Updates an existing project.
   *
   * `PATCH /project/web/{id}` → `ProjectSimpleDto` (partial — `attachments`,
   * `members`, and `tasks` absent).
   *
   * @param id - Surrogate ID of the project.
   * @param dto - Fields to update; only set fields are transmitted.
   * @returns The updated {@link Project} with empty nested arrays —
   *   callers must merge into cached state instead of overwriting.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async update(id: number, dto: UpdateProjectRequest): Promise<Project> {
    const data = await api.patch<ApiResponse>(
      `/project/web/${id}`,
      updateProjectToJson(dto)
    );
    return safeParseProject(data);
  },

  /**
   * Updates an existing project with attachment uploads in a single
   * multipart request.
   *
   * `PATCH /project/web/{id}` (multipart) → `ProjectSimpleDto` (partial).
   *
   * If `files.attachments` is empty, an empty `attachments` field is sent
   * so the backend distinguishes "no upload" from "untouched".
   *
   * @param id - Surrogate ID of the project.
   * @param dto - Fields to update.
   * @param files - Files to upload alongside the request.
   * @returns The updated {@link Project} with empty nested arrays.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
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

  /**
   * Deletes a project.
   *
   * `DELETE /project/web/{id}` → `ApiResponse` (ack only).
   *
   * @param id - Surrogate ID of the project.
   * @returns Resolves once the server acknowledges the deletion.
   * @throws {ApiError} On non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/project/web/${id}`);
  },

  /**
   * Adds an employee to a project's member list.
   *
   * `POST /project/web/{projectId}/employees/{employeeId}` → backend returns
   * the added `EmployeeDto`. The service deliberately discards it and
   * returns `void` — callers reconcile cache state via the mutation hook's
   * invalidations rather than parsing a sibling-domain DTO.
   *
   * @param projectId - Surrogate ID of the project.
   * @param employeeId - Surrogate ID of the employee to add.
   * @returns Resolves once the server acknowledges the addition.
   * @throws {ApiError} On non-2xx response.
   */
  async addEmployee(projectId: number, employeeId: number): Promise<void> {
    await api.post(`/project/web/${projectId}/employees/${employeeId}`, {});
  },

  /**
   * Removes an employee from a project's member list.
   *
   * `DELETE /project/web/{projectId}/employees/{employeeId}` → `ApiResponse`
   * (ack only).
   *
   * @param projectId - Surrogate ID of the project.
   * @param employeeId - Surrogate ID of the employee to remove.
   * @returns Resolves once the server acknowledges the removal.
   * @throws {ApiError} On non-2xx response.
   */
  async removeEmployee(projectId: number, employeeId: number): Promise<void> {
    await api.delete(`/project/web/${projectId}/employees/${employeeId}`);
  },

  /**
   * Fetches every project the given employee is a member of.
   *
   * `GET /project/web/employees/{employeeId}` → `ProjectDto[]` (full).
   *
   * @param employeeId - Surrogate ID of the employee.
   * @returns A resolved array of {@link Project} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getProjectsByEmployee(employeeId: number): Promise<Project[]> {
    const data = await api.get<ApiResponse[]>(
      `/project/web/employees/${employeeId}`
    );
    return safeParseProjects(data);
  },

  /**
   * Fetches every employee assigned as a member of the given project.
   *
   * `GET /project/web/{projectId}/employees` → `EmployeeDto[]`.
   *
   * @param projectId - Surrogate ID of the project.
   * @returns A resolved array of {@link Employee} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getEmployeesByProject(projectId: number): Promise<Employee[]> {
    const data = await api.get<ApiResponse[]>(
      `/project/web/${projectId}/employees`
    );
    return safeParseEmployees(data);
  },
};
