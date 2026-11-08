/**
 * @module member-invitations
 *
 * Invitations by link to join the caller's organization (echno-backend
 * `InvitationControllerWeb`, `/invitations/web`): the address the link goes
 * to, the roles the person gets on acceptance, the employee details the join
 * form collects, and where the invitation stands. The identity provider sends
 * the email; nobody becomes an employee until they accept with the invited
 * address.
 *
 * Named `MemberInvitation*` so it sits beside the invite-code types in
 * `types/invitation` (`Invitation`, `InvitationStatus`), which stay exported
 * until web has moved off them.
 *
 * Invitation and role ids are UUID strings; projects, managers and shift
 * timings keep their numeric ids.
 */

import { z } from 'zod';
import {
  backendDate,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';
import {
  parseLocalDateTime,
  parseUTCDate,
  toLocalDateAtMidnight,
} from '../../lib/utils/date-helpers';

/**
 * Where an invitation stands (backend `InvitationStage`).
 *
 * - `PENDING`: waiting for the person. The link may not have been sent yet;
 *   see {@link MemberInvitation.sentAt}.
 * - `ACCEPTED`: accepted by the invited address; the person is an employee.
 * - `ACCEPTED_BY_ANOTHER_ADDRESS`: the provider let a different address
 *   accept, so nobody was added.
 * - `EXPIRED`: the link stopped working. Resending renews it.
 * - `REVOKED`: an administrator stopped the link.
 * - `UNKNOWN`: a stage this client does not know yet. It offers no action.
 */
export type MemberInvitationStage =
  | 'PENDING'
  | 'ACCEPTED'
  | 'ACCEPTED_BY_ANOTHER_ADDRESS'
  | 'EXPIRED'
  | 'REVOKED'
  | 'UNKNOWN';

const KNOWN_STAGES: readonly MemberInvitationStage[] = [
  'PENDING',
  'ACCEPTED',
  'ACCEPTED_BY_ANOTHER_ADDRESS',
  'EXPIRED',
  'REVOKED',
];

/** A role the invited person gets on acceptance (backend `InvitationRoleDto`). */
export interface MemberInvitationRole {
  /** Id of a role in this organization. */
  roleId: string;
  /** Project the role holds on. Absent for a role across the organization. */
  projectId?: number;
}

/**
 * The employee details an invitation carries into the join (backend
 * `EmployeeJoinOrgDto`). The person's name, contact address and phone come
 * from their account at acceptance, so a request does not send them.
 */
export interface MemberInvitationEmployeeRequest {
  /** Job title, 3 to 50 characters. */
  designation?: string;
  /** Department, 3 to 50 characters. */
  department?: string;
  /** Calendar date the employee joins. Sent as local midnight. */
  joiningDate?: Date;
  /** Organization-assigned employee code, such as `EMP-0042`. */
  employeeId?: string;
  salary?: number;
  /**
   * The reporting manager, an active employee of this organization. Required
   * except for an organization's first employee, who has nobody to report to.
   */
  managerId?: number;
  /** The structured shift timing to assign. */
  shiftTimingId?: number;
  /** Employment status. Defaults to `active`. */
  status?: string;
}

/** The employee details as the backend reads them back. */
export interface MemberInvitationEmployee extends MemberInvitationEmployeeRequest {
  status: string;
  /** Filled from the person's account once they accept. */
  employeeName?: string;
  email?: string;
  phone?: string;
}

/** An invitation and where it stands (backend `InvitationDto`). */
export interface MemberInvitation {
  id: string;
  /** The address the link goes to. Only this exact address can accept it. */
  email: string;
  status: MemberInvitationStage;
  /**
   * When the link stops working. Resending keeps it; resending an expired
   * invitation sends a new link with a new expiry.
   */
  expiresAt?: Date;
  /** When the provider sent the link. Absent while it waits to be sent. */
  sentAt?: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt?: Date;
  /** The user who sent it. Absent for one the system created. */
  invitedByUserId?: number;
  roles: MemberInvitationRole[];
  employee: MemberInvitationEmployee;
}

/** Body of `POST /invitations/web` (backend `InvitationCreationDto`). */
export interface CreateMemberInvitationRequest {
  email: string;
  /** Roles the person gets on acceptance; at most 50. */
  roles: MemberInvitationRole[];
  employee: MemberInvitationEmployeeRequest;
}

/** Query parameters of `GET /invitations/web`. */
export interface MemberInvitationListParams {
  /** Zero-based page index. The backend defaults to 0. */
  pageNo?: number;
  /** Rows per page, 1 to 500. The backend defaults to 10. */
  pageSize?: number;
}

const RoleSchema = z.object({
  roleId: z.string(),
  projectId: nullableNumber,
});

const EmployeeSchema = z.object({
  designation: nullableString,
  department: nullableString,
  joiningDate: backendDate,
  employeeId: nullableString,
  salary: nullableNumber,
  managerId: nullableNumber,
  shiftTimingId: nullableNumber,
  status: nullableString,
  employeeName: nullableString,
  email: nullableString,
  phone: nullableString,
});

const MemberInvitationResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: nullableString,
  expiresAt: backendDate,
  sentAt: backendDate,
  acceptedAt: backendDate,
  revokedAt: backendDate,
  createdAt: backendDate,
  invitedByUserId: nullableNumber,
  roles: z.array(RoleSchema).nullish(),
  employee: EmployeeSchema.nullish(),
});

function stageOf(value: string | null | undefined): MemberInvitationStage {
  return KNOWN_STAGES.includes(value as MemberInvitationStage)
    ? (value as MemberInvitationStage)
    : 'UNKNOWN';
}

/**
 * Parses a raw API payload into a typed {@link MemberInvitation}.
 *
 * Non-strict: unknown keys are dropped. A stage this client does not know
 * reads as `UNKNOWN`, so it is never offered a resend or a revoke. The
 * timestamps are instants and read as UTC; the joining date is a calendar
 * date and reads in local time, matching how it was written.
 *
 * @throws {Error} If `id` or `email` is missing.
 */
export function parseMemberInvitation(json: unknown): MemberInvitation {
  const raw = MemberInvitationResponseSchema.parse(json);
  const employee = raw.employee ?? {};
  return {
    id: raw.id,
    email: raw.email,
    status: stageOf(raw.status),
    expiresAt: parseUTCDate(raw.expiresAt) ?? undefined,
    sentAt: parseUTCDate(raw.sentAt) ?? undefined,
    acceptedAt: parseUTCDate(raw.acceptedAt) ?? undefined,
    revokedAt: parseUTCDate(raw.revokedAt) ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    invitedByUserId: raw.invitedByUserId ?? undefined,
    roles: (raw.roles ?? []).map((role) => ({
      roleId: role.roleId,
      projectId: role.projectId ?? undefined,
    })),
    employee: {
      designation: employee.designation ?? undefined,
      department: employee.department ?? undefined,
      joiningDate: parseLocalDateTime(employee.joiningDate) ?? undefined,
      employeeId: employee.employeeId ?? undefined,
      salary: employee.salary ?? undefined,
      managerId: employee.managerId ?? undefined,
      shiftTimingId: employee.shiftTimingId ?? undefined,
      status: employee.status ?? 'active',
      employeeName: employee.employeeName ?? undefined,
      email: employee.email ?? undefined,
      phone: employee.phone ?? undefined,
    },
  };
}

function employeeToJson(employee: MemberInvitationEmployeeRequest): Record<string, unknown> {
  const json: Record<string, unknown> = { status: employee.status ?? 'active' };
  if (employee.designation !== undefined) json.designation = employee.designation;
  if (employee.department !== undefined) json.department = employee.department;
  if (employee.joiningDate !== undefined) json.joiningDate = toLocalDateAtMidnight(employee.joiningDate);
  if (employee.employeeId !== undefined) json.employeeId = employee.employeeId;
  if (employee.salary !== undefined) json.salary = employee.salary;
  if (employee.managerId !== undefined) json.managerId = employee.managerId;
  if (employee.shiftTimingId !== undefined) json.shiftTimingId = employee.shiftTimingId;
  return json;
}

/**
 * Serializes a {@link CreateMemberInvitationRequest} into the body of
 * `POST /invitations/web`. A role across the organization sends no
 * `projectId`, and an absent employee detail is left out rather than sent
 * as null.
 */
export function createMemberInvitationToJson(
  request: CreateMemberInvitationRequest
): Record<string, unknown> {
  return {
    email: request.email.trim(),
    roles: request.roles.map((role) =>
      role.projectId === undefined
        ? { roleId: role.roleId }
        : { roleId: role.roleId, projectId: role.projectId }
    ),
    employee: employeeToJson(request.employee),
  };
}

/**
 * Whether an invitation can still be resent or revoked. Both apply to a
 * pending invitation and to an expired one (resending an expired one renews
 * its link and expiry); an accepted, revoked or unknown one offers neither.
 */
export function isMemberInvitationOpen(invitation: Pick<MemberInvitation, 'status'>): boolean {
  return invitation.status === 'PENDING' || invitation.status === 'EXPIRED';
}
