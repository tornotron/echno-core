import { api } from '../lib/api/api-client';
import { OrgRole } from '../types/employee';

/**
 * @module role-management-service
 *
 * Typed client for the Keycloak Group Controller Web endpoints under
 * `/keycloakGroup/web`. Provides convenience methods for assigning and
 * unassigning organization roles ({@link OrgRole}) to an employee.
 *
 * Both endpoints respond with `ApiResponse` (ack — no payload), so each
 * method discards the body and resolves `void`. Callers patch cached
 * employee state from the request parameters; see `useAssignRole` /
 * `useUnassignRole`.
 */
export const roleManagementService = {
  /**
   * Assigns an organization role to an employee.
   *
   * `POST /keycloakGroup/web/assignRole` → `ApiResponse` (ack).
   *
   * @param employeeId - The employee's numeric id.
   * @param orgRole - The role to assign.
   * @returns Resolves once the request succeeds; the ack body is discarded.
   * @throws {ApiError} On non-2xx HTTP responses.
   */
  async assignRole(employeeId: number, orgRole: OrgRole): Promise<void> {
    await api.post(
      '/keycloakGroup/web/assignRole',
      {},
      { employeeId, orgRole }
    );
  },

  /**
   * Unassigns an organization role from an employee.
   *
   * `POST /keycloakGroup/web/unassignRole` → `ApiResponse` (ack).
   *
   * @param employeeId - The employee's numeric id.
   * @param orgRole - The role to remove.
   * @returns Resolves once the request succeeds; the ack body is discarded.
   * @throws {ApiError} On non-2xx HTTP responses.
   */
  async unassignRole(employeeId: number, orgRole: OrgRole): Promise<void> {
    await api.post(
      '/keycloakGroup/web/unassignRole',
      {},
      { employeeId, orgRole }
    );
  },
};
