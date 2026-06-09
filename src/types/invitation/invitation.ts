import { parsePositiveInt } from '../../lib/utils/parse-id';

export enum InvitationStatus {
  pending = 'pending',
  accepted = 'accepted',
  rejected = 'rejected',
  expired = 'expired',
}

export interface Invitation {
  id: number;
  projectId: number;
  inviteCode: string;
  role: string;
  expiryDate?: Date;
  maxUsageCount?: number;
  usageCount: number;
  status: string;
  createdDate: Date;
}

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
