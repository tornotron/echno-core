/**
 * @module invitation
 *
 * Invitation domain model, status helpers, and (de)serialization utilities
 * for the `project-invite-code-controller` backend.
 *
 * The backend issues organization-scoped invite codes that carry the invited
 * employee's details (`employeeDetails`). This module exposes the `Invitation`
 * type, the `parseInvitation` mapper (backend JSON → typed object), the inverse
 * `invitationToJson`, status/validity helpers, and share-message builders
 * (`whatsappMessage`, `emailSubject`, `emailBody`).
 *
 * Backend field mapping (see {@link parseInvitation}):
 * - `code` → `inviteCode`
 * - `active` → `isActive`
 * - `currentUses` → `usedCount`
 */

import { parseUTCDate } from '../../lib/utils/date-helpers';

/**
 * Normalized invitation status derived from `isActive`, `expiryDate`, and
 * usage counts via {@link getInvitationStatus}.
 */
export enum InvitationStatus {
  /** Active, not expired, and usage slots remain. */
  pending = 'pending',
  /** Fully consumed (all usage slots filled). */
  accepted = 'accepted',
  /** Explicitly inactive or in an unrecognized state. */
  rejected = 'rejected',
  /** Past its expiry date. */
  expired = 'expired',
}

/**
 * Employee details carried by an invitation. `department` and `designation`
 * are always present; the remaining fields are optional.
 */
export interface EmployeeDetails {
  department: string;
  designation: string;
  email?: string;
  employeeId?: string;
  employeeName?: string;
  joiningDate?: Date;
  phone?: string;
  managerId?: number;
  salary?: number;
  shiftTiming?: string;
  status?: string;
}

/**
 * An organization invite code and its associated employee details.
 */
export interface Invitation {
  id?: number;
  inviteCode: string;
  expiryDate?: Date;
  maxUses?: number;
  usedCount: number;
  employeeDetails: EmployeeDetails;
  isActive: boolean;
  /** Present on validation responses. */
  organizationId?: number;
  /** Present on validation responses. */
  organizationName?: string;
}

/**
 * Parses a raw backend payload into a typed {@link Invitation}.
 *
 * Applies defensive fallbacks for inconsistent payloads and normalizes all
 * date fields to `Date` instances.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `Invitation` domain object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseInvitation(json: any): Invitation {
  const employeeDetails: EmployeeDetails = {
    department: json.employeeDetails?.department ?? '',
    designation: json.employeeDetails?.designation ?? '',
    email: json.employeeDetails?.email ?? undefined,
    employeeId: json.employeeDetails?.employeeId ?? undefined,
    employeeName: json.employeeDetails?.employeeName ?? undefined,
    joiningDate: parseUTCDate(json.employeeDetails?.joiningDate) ?? undefined,
    phone: json.employeeDetails?.phone ?? undefined,
    managerId: json.employeeDetails?.managerId ?? undefined,
    salary:
      json.employeeDetails?.salary == null
        ? undefined
        : Number(json.employeeDetails.salary),
    shiftTiming: json.employeeDetails?.shiftTiming ?? undefined,
    status: json.employeeDetails?.status ?? undefined,
  };

  return {
    id: json.id ?? undefined,
    inviteCode: json.code == null ? '' : String(json.code),
    expiryDate: parseUTCDate(json.expiryDate) ?? undefined,
    maxUses: json.maxUses ?? undefined,
    usedCount: json.currentUses ?? 0,
    employeeDetails,
    isActive: json.active ?? true,
    organizationId: json.organizationId ?? undefined,
    organizationName: json.organizationName ?? undefined,
  };
}

/**
 * Serializes an {@link Invitation} to the backend JSON shape.
 *
 * @param inv - The invitation to serialize.
 * @returns A plain object matching the backend's payload shape.
 */
export function invitationToJson(inv: Invitation): Record<string, unknown> {
  return {
    id: inv.id,
    code: inv.inviteCode,
    expiryDate: inv.expiryDate?.toISOString(),
    maxUses: inv.maxUses,
    currentUses: inv.usedCount,
    employeeDetails: {
      department: inv.employeeDetails.department,
      designation: inv.employeeDetails.designation,
      email: inv.employeeDetails.email,
      employeeId: inv.employeeDetails.employeeId,
      employeeName: inv.employeeDetails.employeeName,
      joiningDate: inv.employeeDetails.joiningDate?.toISOString(),
      phone: inv.employeeDetails.phone,
      managerId: inv.employeeDetails.managerId,
      salary: inv.employeeDetails.salary,
      shiftTiming: inv.employeeDetails.shiftTiming,
      status: inv.employeeDetails.status,
    },
    active: inv.isActive,
  };
}

/**
 * Derives the normalized {@link InvitationStatus} from `isActive`, `expiryDate`,
 * and usage counts.
 *
 * @param inv - The invitation to evaluate.
 * @returns The computed status.
 */
export function getInvitationStatus(inv: Invitation): InvitationStatus {
  if (!inv.isActive) {
    return InvitationStatus.rejected;
  }
  if (inv.expiryDate && new Date() > inv.expiryDate) {
    return InvitationStatus.expired;
  }
  if (inv.maxUses && inv.usedCount && inv.usedCount >= inv.maxUses) {
    return InvitationStatus.accepted;
  }
  return InvitationStatus.pending;
}

/** Returns `true` if the invitation has passed its expiry date. */
export function isExpired(inv: Invitation): boolean {
  if (!inv.expiryDate) return false;
  return new Date() > inv.expiryDate;
}

/** Returns `true` if the invitation is active, unexpired, and has usage slots left. */
export function isInvitationValid(inv: Invitation): boolean {
  if (!inv.isActive) return false;
  if (isExpired(inv)) return false;
  if (inv.maxUses && inv.usedCount && inv.usedCount >= inv.maxUses) {
    return false;
  }
  return true;
}

/** Builds a WhatsApp/plain-text share message for an invitation. */
export function whatsappMessage(
  inv: Invitation,
  organizationName?: string
): string {
  const lines = [
    '*Employee Invitation*',
    '',
    `You've been invited to join${organizationName ? ` *${organizationName}*` : ' the organization'}!`,
    '',
    `*Position*: ${inv.employeeDetails.designation}`,
    `*Department*: ${inv.employeeDetails.department}`,
  ];

  if (inv.employeeDetails.employeeId) {
    lines.push(`*Employee ID*: ${inv.employeeDetails.employeeId}`);
  }

  if (inv.employeeDetails.joiningDate) {
    const d = inv.employeeDetails.joiningDate;
    lines.push(
      `*Start Date*: ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
    );
  }
  if (inv.employeeDetails.shiftTiming)
    lines.push(`*Shift Timing*: ${inv.employeeDetails.shiftTiming}`);

  lines.push(
    '',
    `*Invite Code*: *${inv.inviteCode}*`,
    '',
    'Download the Echno Attendance app and use this code to join the organization.'
  );

  return lines.join('\n');
}

/** Builds the email subject line for an invitation. */
export function emailSubject(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inv: Invitation,
  organizationName?: string
): string {
  return `Employee Invitation${organizationName ? ` - ${organizationName}` : ''}`;
}

/** Builds the email body for an invitation. */
export function emailBody(inv: Invitation, organizationName?: string): string {
  const lines = [
    `Dear Employee,`,
    '',
    `You have been invited to join${organizationName ? ` ${organizationName}` : ' the organization'} as a ${inv.employeeDetails.designation} in the ${inv.employeeDetails.department} department.`,
    '',
    'Employee Details:',
  ];

  if (inv.employeeDetails.employeeId) {
    lines.push(`- Employee ID: ${inv.employeeDetails.employeeId}`);
  }
  lines.push(
    `- Position: ${inv.employeeDetails.designation}`,
    `- Department: ${inv.employeeDetails.department}`
  );

  if (inv.employeeDetails.joiningDate) {
    const d = inv.employeeDetails.joiningDate;
    lines.push(
      `- Start Date: ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
    );
  }
  if (inv.employeeDetails.shiftTiming)
    lines.push(`- Shift Timing: ${inv.employeeDetails.shiftTiming}`);

  lines.push(
    '',
    `Your invitation code is: ${inv.inviteCode}`,
    '',
    'To get started:',
    '1. Download the Echno Attendance mobile app',
    '2. Open the app and select "Join with Invite Code"',
    '3. Enter the code: ' + inv.inviteCode,
    '4. Complete your profile setup',
    '',
    '',
    'Welcome to the team!',
    '',
    'Best regards,',
    'HR Team'
  );

  return lines.join('\n');
}
