/**
 * @module employee-join
 *
 * Request shape for adding an existing user to an organization as an employee
 * (`POST /employee/web/joinOrganization/userId/{userId}/organizationId/{organizationId}`,
 * backend `EmployeeJoinOrgDto`). This is the administrative join; a person with
 * no membership yet arrives through the invitation flow instead, and the invite
 * carries the same manager (see `GenerateInviteCodeRequest`).
 */

import { EmployeeStatus } from './employee-status';

/**
 * Body of the administrative join.
 *
 * A newly created employee must have a reporting manager (ClickUp 14zdkkvrf25,
 * backend #823), so `managerId` is required. `null` is accepted for exactly one
 * case, the first employee of an organization that has no active employee yet;
 * for any other organization the backend refuses it with a 400 naming
 * `managerId`. The manager must be an employee of the same organization.
 */
export interface JoinOrganizationRequest {
  managerId: number | null;
  /** Employment status the new record starts in. Defaults to `active`. */
  status?: EmployeeStatus;
}
