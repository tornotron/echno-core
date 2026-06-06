// types/issue/issue-status.ts

export enum IssueStatus {
  open = 'open',
  inProgress = 'inProgress',
  pending = 'pending',
  inReview = 'inReview',
  blocked = 'blocked',
  reOpened = 'reOpened',
  resolved = 'resolved',
  closed = 'closed',
}

//** Human-readable label */
export function getIssueStatusLabel(status: IssueStatus): string {
  const map: Record<IssueStatus, string> = {
    [IssueStatus.open]: 'Open',
    [IssueStatus.inProgress]: 'In Progress',
    [IssueStatus.pending]: 'Pending',
    [IssueStatus.inReview]: 'In Review',
    [IssueStatus.blocked]: 'Blocked',
    [IssueStatus.reOpened]: 'Re-Opened',
    [IssueStatus.resolved]: 'Resolved',
    [IssueStatus.closed]: 'Closed',
  };
  return map[status];
}

/** Tailwind-friendly hex color */
export function getIssueStatusColor(status: IssueStatus): string {
  const map: Record<IssueStatus, string> = {
    [IssueStatus.open]: '#E57373',
    [IssueStatus.inProgress]: '#64B5F6',
    [IssueStatus.pending]: '#FFB74D',
    [IssueStatus.inReview]: '#9575CD',
    [IssueStatus.blocked]: '#F06292',
    [IssueStatus.reOpened]: '#FF8A65',
    [IssueStatus.resolved]: '#81C784',
    [IssueStatus.closed]: '#A5D6A7',
  };
  return map[status];
}

/** Lucide / Heroicons equivalent (you can replace with your icon library) */
export function getIssueStatusIcon(status: IssueStatus): string {
  const map: Record<IssueStatus, string> = {
    [IssueStatus.open]: 'circle',
    [IssueStatus.inProgress]: 'refresh-cw',
    [IssueStatus.pending]: 'clock',
    [IssueStatus.inReview]: 'file-text',
    [IssueStatus.blocked]: 'x-circle',
    [IssueStatus.reOpened]: 'rotate-cw',
    [IssueStatus.resolved]: 'check-circle',
    [IssueStatus.closed]: 'check-circle-outline',
  };
  return map[status];
}

/** Convert string → IssueStatus */
export function issueStatusFromString(str: string): IssueStatus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (IssueStatus as any)[str];
  if (!status) throw new Error(`Invalid issue status: ${str}`);
  return status;
}
