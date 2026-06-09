/**
 * @module invitation
 *
 * Core `Invitation` domain type, status enum, parser, and status helper.
 *
 * Note: `Invitation.projectId` reflects a legacy backend field name; the
 * live spec endpoint is organization-scoped and a rename to `organizationId`
 * is pending an `integrate-module` pass.
 */

import { parsePositiveInt } from '../../lib/utils/parse-id';

/**
 * Normalized status values derived from the raw backend status string.
 *
 * The backend stores status as a freeform string (`'active'`, `'expired'`,
 * `'used'`, etc.). Use {@link getInvitationStatus} to convert to this enum.
 */
export enum InvitationStatus {
  /** Invite code is active and within usage and expiry limits. */
  pending = 'pending',
  /** Invite code has been fully consumed (all usage slots filled). */
  accepted = 'accepted',
  /** Invite code was rejected or is in an unrecognized state. */
  rejected = 'rejected',
  /** Invite code has passed its expiry date. */
  expired = 'expired',
}

/**
 * Represents a project invite code record.
 */
export interface Invitation {
  /** Unique surrogate identifier. */
  id: number;
  /**
   * ID of the associated project. Note: the live spec endpoint is
   * organization-scoped; this field will be renamed to `organizationId`
   * after the service paths are realigned.
   */
  projectId: number;
  /** The invite code string shared with invitees. */
  inviteCode: string;
  /** Role to assign when the invite code is accepted. */
  role: string;
  /** Optional expiry date after which the code is no longer valid. */
  expiryDate?: Date;
  /** Maximum number of times the code can be used. `undefined` means unlimited. */
  maxUsageCount?: number;
  /** Number of times the code has been used. */
  usageCount: number;
  /** Raw status string from the backend (`'active'`, `'expired'`, `'used'`, etc.). */
  status: string;
  /** Timestamp when this invite code was created. */
  createdDate: Date;
}

/**
 * Derives a normalized {@link InvitationStatus} from the raw backend status string.
 *
 * Maps `'active'` to `pending`, `expired`, or `accepted` based on expiry date
 * and usage-count checks. Maps `'used'` and `'completed'` to `accepted`.
 * Falls back to `rejected` for any unrecognized value.
 *
 * @param inv - The invitation to evaluate.
 * @returns The computed {@link InvitationStatus}.
 */
export function getInvitationStatus(inv: Invitation): InvitationStatus {
  const s = inv.status?.toLowerCase();
  if (s === 'active') {
    if (inv.expiryDate && new Date() > inv.expiryDate)
      return InvitationStatus.expired;
    if (inv.maxUsageCount != null && inv.usageCount >= inv.maxUsageCount)
      return InvitationStatus.accepted;
    return InvitationStatus.pending;
  }
  if (s === 'expired') return InvitationStatus.expired;
  if (s === 'used' || s === 'completed') return InvitationStatus.accepted;
  return InvitationStatus.rejected;
}

/**
 * Parses a raw API payload into a typed {@link Invitation}.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `Invitation` domain object.
 * @throws {Error} If `id` or `projectId` is not a positive integer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseInvitation(json: any): Invitation {
  const id = parsePositiveInt(json.id, 'parseInvitation.id');
  const projectId = parsePositiveInt(
    json.projectId,
    'parseInvitation.projectId'
  );
  return {
    id,
    projectId,
    inviteCode: String(json.inviteCode ?? ''),
    role: json.role ?? '',
    expiryDate: json.expiryDate ? new Date(json.expiryDate) : undefined,
    maxUsageCount: json.maxUsageCount ?? undefined,
    usageCount: json.usageCount ?? 0,
    status: json.status ?? '',
    createdDate: json.createdDate ? new Date(json.createdDate) : new Date(),
  };
}
