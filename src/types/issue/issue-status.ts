/**
 * @module types/issue/issue-status
 *
 * Enumeration of the lifecycle states an {@link Issue} can occupy, with
 * helpers for human-readable labels, status-coded colors, and icon names.
 */

/**
 * Lifecycle state of an {@link Issue}. The string values match the
 * backend's wire representation; do not rename without coordinating a
 * backend change.
 */
export enum IssueStatus {
  /** Newly created and not yet picked up. */
  open = 'open',

  /** Actively being worked on. */
  inProgress = 'inProgress',

  /** Awaiting external input (information, decision, dependency). */
  pending = 'pending',

  /** Submitted for review by a peer or supervisor. */
  inReview = 'inReview',

  /** Cannot progress until an obstacle is cleared. */
  blocked = 'blocked',

  /** Previously resolved/closed and re-opened after regression. */
  reOpened = 'reOpened',

  /** Work complete pending final confirmation/close. */
  resolved = 'resolved',

  /** Final state — no further action expected. */
  closed = 'closed',
}

/**
 * Returns a human-readable label for the given status (e.g. "In Progress").
 *
 * @param status - The status to label.
 * @returns Display-ready label string.
 */
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

/**
 * Returns a hex color associated with the given status, suitable for status
 * badges and chips in the UI.
 *
 * @param status - The status to color-code.
 * @returns A 6-digit hex color (e.g. `'#E57373'`).
 */
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

/**
 * Returns a Lucide/Heroicons-compatible icon name for the given status.
 *
 * @param status - The status to icon-code.
 * @returns A kebab-case icon identifier.
 */
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

/**
 * Parses a wire-format string into an {@link IssueStatus}.
 *
 * @param str - The backend's string representation of the status.
 * @returns The matching {@link IssueStatus} member.
 * @throws {Error} If `str` does not match any known status.
 */
export function issueStatusFromString(str: string): IssueStatus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (IssueStatus as any)[str];
  if (!status) throw new Error(`Invalid issue status: ${str}`);
  return status;
}
