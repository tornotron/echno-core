/**
 * @module types/leave/leave-enums
 *
 * Enumeration types for the leave-management domain ({@link LeaveStatus},
 * {@link HalfDayType}, {@link ApprovalAction}, {@link TransactionType},
 * {@link LeaveNotificationType}) plus their presentation helpers. Each enum
 * value matches the backend's SCREAMING_SNAKE_CASE string.
 */

/** Lifecycle state of a leave request. */
export enum LeaveStatus {
  /** Created but not yet submitted for approval. */
  DRAFT = 'DRAFT',
  /** Submitted and awaiting an approval decision. */
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  /** Approved through the full chain. */
  APPROVED = 'APPROVED',
  /** Rejected at some approval step. */
  REJECTED = 'REJECTED',
  /** Cancelled after approval. */
  CANCELLED = 'CANCELLED',
  /** Withdrawn by the employee before a decision. */
  WITHDRAWN = 'WITHDRAWN',
}

/** Whether a leave day is full or which half is taken. */
export enum HalfDayType {
  /** A full working day of leave. */
  FULL_DAY = 'FULL_DAY',
  /** First half of the working day. */
  FIRST_HALF = 'FIRST_HALF',
  /** Second half of the working day. */
  SECOND_HALF = 'SECOND_HALF',
}

/** Outcome recorded at a single approval step. */
export enum ApprovalAction {
  /** Awaiting the approver's decision. */
  PENDING = 'PENDING',
  /** Approved at this step. */
  APPROVED = 'APPROVED',
  /** Rejected at this step. */
  REJECTED = 'REJECTED',
  /** Escalated to a higher approver. */
  ESCALATED = 'ESCALATED',
  /** Delegated to another approver. */
  DELEGATED = 'DELEGATED',
}

/** Category of a leave-balance ledger entry. */
export enum TransactionType {
  /** Starting balance for the period. */
  OPENING_BALANCE = 'OPENING_BALANCE',
  /** Periodic accrual credit. */
  ACCRUAL = 'ACCRUAL',
  /** Balance carried forward from the prior period. */
  CARRY_FORWARD = 'CARRY_FORWARD',
  /** Debit for taken leave. */
  DEDUCTION = 'DEDUCTION',
  /** Reversal of a prior debit (e.g. cancelled leave). */
  REVERSAL = 'REVERSAL',
  /** Manual adjustment. */
  ADJUSTMENT = 'ADJUSTMENT',
  /** Expiry of unused carried-forward balance. */
  EXPIRY = 'EXPIRY',
}

/** Category of a leave notification. */
export enum LeaveNotificationType {
  /** A request was submitted. */
  LEAVE_REQUEST_SUBMITTED = 'LEAVE_REQUEST_SUBMITTED',
  /** A request is pending the recipient's approval. */
  LEAVE_PENDING_APPROVAL = 'LEAVE_PENDING_APPROVAL',
  /** A request was approved. */
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  /** A request was rejected. */
  LEAVE_REJECTED = 'LEAVE_REJECTED',
  /** A request was cancelled. */
  LEAVE_CANCELLED = 'LEAVE_CANCELLED',
  /** An employee's balance is running low. */
  LEAVE_BALANCE_LOW = 'LEAVE_BALANCE_LOW',
  /** A reminder about upcoming or pending leave. */
  LEAVE_REMINDER = 'LEAVE_REMINDER',
  /** An approval was delegated to the recipient. */
  APPROVAL_DELEGATED = 'APPROVAL_DELEGATED',
}

/**
 * Returns the human-readable label for a leave status.
 *
 * @param status - The status to format.
 * @returns The display label (e.g. `'Pending Approval'`); the raw value as a
 *   string for any unmapped status.
 */
export function getLeaveStatusLabel(status: LeaveStatus): string {
  const labels: Record<LeaveStatus, string> = {
    [LeaveStatus.DRAFT]: 'Draft',
    [LeaveStatus.PENDING_APPROVAL]: 'Pending Approval',
    [LeaveStatus.APPROVED]: 'Approved',
    [LeaveStatus.REJECTED]: 'Rejected',
    [LeaveStatus.CANCELLED]: 'Cancelled',
    [LeaveStatus.WITHDRAWN]: 'Withdrawn',
  };
  return labels[status] ?? String(status);
}

/**
 * Returns the Tailwind badge classes for a leave status.
 *
 * @param status - The status to map.
 * @returns A space-separated Tailwind class string (light + dark variants).
 */
export function getLeaveStatusColor(status: LeaveStatus): string {
  const colors: Record<LeaveStatus, string> = {
    [LeaveStatus.DRAFT]:
      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    [LeaveStatus.PENDING_APPROVAL]:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    [LeaveStatus.APPROVED]:
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    [LeaveStatus.REJECTED]:
      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    [LeaveStatus.CANCELLED]:
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    [LeaveStatus.WITHDRAWN]:
      'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
  };
  return colors[status];
}

/**
 * Returns the human-readable label for an approval action.
 *
 * @param action - The approval action to format.
 * @returns The display label (e.g. `'Escalated'`).
 */
export function getApprovalActionLabel(action: ApprovalAction): string {
  const labels: Record<ApprovalAction, string> = {
    [ApprovalAction.PENDING]: 'Pending',
    [ApprovalAction.APPROVED]: 'Approved',
    [ApprovalAction.REJECTED]: 'Rejected',
    [ApprovalAction.ESCALATED]: 'Escalated',
    [ApprovalAction.DELEGATED]: 'Delegated',
  };
  return labels[action];
}
