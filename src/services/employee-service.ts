/**
 * @module services/employee-service
 *
 * Typed client for the backend employee endpoints (base path `/employee/web`).
 *
 * Wraps `api.*` calls and parses raw JSON into strongly-typed
 * {@link Employee} domain objects via {@link parseEmployee}. Parse failures
 * surface as a 422 {@link ApiError}.
 *
 * @remarks
 * Two service-level findings to be aware of:
 *
 * 1. {@link employeeService.create} POSTs to `/employee/web` but the backend
 *    OpenAPI spec exposes **no such endpoint** — the only employee POST is
 *    `joinOrganization`. The method is preserved against the day a direct
 *    create endpoint lands; the consuming `useCreateEmployee` hook fails
 *    fast in the meantime.
 * 2. `PATCH /employee/web/{id}` is labelled `ApiResponse` (ack) in the spec
 *    but the live backend returns an `EmployeeDto`-shaped body. The service
 *    parses optimistically; mutation hooks apply a 3-way guarded patch to
 *    survive future divergence.
 *
 * @see {@link Employee} domain shape
 * @see {@link employeeKeys} React Query key factory for these endpoints
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { Employee, parseEmployee } from '../types/employee/employee';
import {
  CreateEmployeeRequest,
  createEmployeeToJson,
} from '../types/employee/employee-create';
import {
  UpdateEmployeeRequest,
  updateEmployeeToJson,
} from '../types/employee/employee-update';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseEmployee(data: ApiResponse): Employee {
  try {
    return parseEmployee(data);
  } catch (error) {
    logger.error('Failed to parse employee data:', error);
    throw new ApiError(
      'Failed to process employee data. Please try again.',
      422
    );
  }
}

function safeParseEmployees(data: ApiResponse[]): Employee[] {
  if (!Array.isArray(data)) {
    return [];
  }
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

/**
 * A parsed page of employees, mirroring the Spring `Page<EmployeeDto>` envelope.
 */
export interface PagedEmployee {
  /** The employees on this page. */
  content: Employee[];
  /** Total employees across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** 0-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/** Paging options for the paginated employee list. */
export interface EmployeePageParams {
  /** 0-based page index. Defaults to 0 on the backend. */
  page?: number;
  /** Page size. Defaults to 10 on the backend. */
  size?: number;
}

/**
 * Normalizes a Spring `Page<EmployeeDto>` body (or a bare array, for
 * resilience) into a {@link PagedEmployee} so callers always receive page
 * metadata.
 */
function safeParseEmployeePage(
  data: ApiResponse,
  params: EmployeePageParams
): PagedEmployee {
  if (Array.isArray(data)) {
    const content = safeParseEmployees(data);
    return {
      content,
      totalElements: content.length,
      totalPages: 1,
      number: 0,
      size: params.size ?? content.length,
    };
  }
  return {
    content: safeParseEmployees(data?.content ?? []),
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    number: data?.number ?? 0,
    size: data?.size ?? params.size ?? 10,
  };
}

export const employeeService = {
  /**
   * Fetches every employee record visible to the caller.
   *
   * `GET /employee/web` → `EmployeeDto[]` (full).
   *
   * Returns an empty array when the payload is not an array (defensive
   * against legacy ack-only responses).
   *
   * @returns Parsed {@link Employee} records.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async getAll(): Promise<Employee[]> {
    const data = await api.get<ApiResponse[]>('/employee/web');
    return safeParseEmployees(data);
  },

  /**
   * Fetches one page of employees, ordered alphabetically by name.
   *
   * `GET /employee/web/paginated` → `Page<EmployeeDto>`. The Spring page
   * envelope is normalized to {@link PagedEmployee}. Use {@link getAll} where
   * the full set is required (dropdowns, name resolution).
   *
   * @param params - 0-based `page` and `size` (both optional).
   * @returns A {@link PagedEmployee} page of employees.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async getPage(params: EmployeePageParams = {}): Promise<PagedEmployee> {
    const query: Record<string, number> = {};
    if (params.page !== undefined) query.pageNo = params.page;
    if (params.size !== undefined) query.pageSize = params.size;
    const data = await api.get<ApiResponse>('/employee/web/paginated', query);
    return safeParseEmployeePage(data, params);
  },

  /**
   * Fetches a single employee by surrogate ID.
   *
   * `GET /employee/web/{id}` → `EmployeeDto` (full).
   *
   * @param id - Surrogate ID of the employee.
   * @returns The parsed {@link Employee}.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async getById(id: number): Promise<Employee> {
    const data = await api.get<ApiResponse>(`/employee/web/${id}`);
    return safeParseEmployee(data);
  },

  /**
   * Creates a new employee.
   *
   * `POST /employee/web` → `EmployeeDto` (full, expected).
   *
   * @remarks
   * **The backend has no such endpoint.** Calls will fail with a 404 / 405
   * transport error. The consuming `useCreateEmployee` hook fails fast and
   * directs callers to `useJoinOrganization` instead. Kept for future API
   * growth.
   *
   * @param dto - Create payload; rendered via {@link createEmployeeToJson}.
   * @returns The parsed {@link Employee}.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async create(dto: CreateEmployeeRequest): Promise<Employee> {
    const payload = createEmployeeToJson(dto);
    const data = await api.post<ApiResponse>('/employee/web', payload);
    return safeParseEmployee(data);
  },

  /**
   * Updates an existing employee.
   *
   * `PATCH /employee/web/{id}` → spec labels `ApiResponse` (ack); the live
   * backend returns an `EmployeeDto`-shaped body. The service parses
   * optimistically.
   *
   * @param id - Surrogate ID of the employee being updated.
   * @param dto - Partial update payload.
   * @returns The parsed {@link Employee} from the server response. Mutation
   *   hooks apply a 3-way guarded patch in case the response shape drifts
   *   back to spec.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async update(id: number, dto: UpdateEmployeeRequest): Promise<Employee> {
    const payload = updateEmployeeToJson(dto);
    const data = await api.patch<ApiResponse>(`/employee/web/${id}`, payload);
    return safeParseEmployee(data);
  },

  /**
   * Deletes an employee.
   *
   * `DELETE /employee/web/{id}` → `ApiResponse` (ack).
   *
   * @param id - Surrogate ID of the employee being removed.
   * @throws {ApiError} On non-2xx transport responses.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/employee/web/${id}`);
  },

  /**
   * Provisions a new employee record for a user joining an organization.
   *
   * `POST /employee/web/joinOrganization/{userId}/{organizationId}` →
   * `EmployeeDto` (full).
   *
   * This is the only employee-create code path the backend actually
   * supports today.
   *
   * @param userId - Surrogate ID of the user joining.
   * @param organizationId - Surrogate ID of the target organization.
   * @returns The newly-created {@link Employee} record.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async joinOrganization(
    userId: number,
    organizationId: number
  ): Promise<Employee> {
    const data = await api.post<ApiResponse>(
      `/employee/web/joinOrganization/${userId}/${organizationId}`,
      {}
    );
    return safeParseEmployee(data);
  },

  /**
   * Assigns a manager to an employee.
   *
   * `PUT /employee/web/employeeId/{employeeId}/managerId/{managerId}` →
   * `EmployeeDto` (full).
   *
   * @param employeeId - Surrogate ID of the employee whose manager is being set.
   * @param managerId - Surrogate ID of the new manager.
   * @returns The updated {@link Employee} with `managerId` / `managerName` populated.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async assignManager(
    employeeId: number,
    managerId: number
  ): Promise<Employee> {
    const data = await api.put<ApiResponse>(
      `/employee/web/employeeId/${employeeId}/managerId/${managerId}`,
      {}
    );
    return safeParseEmployee(data);
  },

  /**
   * Removes the current manager from an employee.
   *
   * `DELETE /employee/web/employeeId/{employeeId}/manager` →
   * `EmployeeDto` (full).
   *
   * @param employeeId - Surrogate ID of the employee whose manager is being cleared.
   * @returns The updated {@link Employee} with `managerId` / `managerName` cleared.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async removeManager(employeeId: number): Promise<Employee> {
    const data = await api.delete<ApiResponse>(
      `/employee/web/employeeId/${employeeId}/manager`
    );
    return safeParseEmployee(data);
  },

  /**
   * Fetches the direct reports of a manager.
   *
   * `GET /employee/web/managerId/{managerId}/subordinates` →
   * `EmployeeDto[]` (full).
   *
   * @param managerId - Surrogate ID of the manager.
   * @returns The manager's direct reports.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async getSubordinates(managerId: number): Promise<Employee[]> {
    const data = await api.get<ApiResponse[]>(
      `/employee/web/managerId/${managerId}/subordinates`
    );
    return safeParseEmployees(data);
  },

  /**
   * Fetches every employee who is a manager (i.e. has at least one direct
   * report).
   *
   * `GET /employee/web/managers` → `EmployeeDto[]` (full).
   *
   * @returns The set of employees that act as managers.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async getManagers(): Promise<Employee[]> {
    const data = await api.get<ApiResponse[]>(`/employee/web/managers`);
    return safeParseEmployees(data);
  },
};
