/**
 * @module types/leave/leave-approval
 *
 * The {@link LeaveApproval} entity plus the action payload
 * ({@link LeaveApprovalAction}) and response shapes
 * ({@link ApprovalChainResponse}, {@link CanApproveResponse}) for the leave
 * approval workflow, with the parser {@link parseLeaveApproval} and serializer
 * {@link approvalActionToJson}.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { parsePositiveInt } from '../../lib/utils/parse-id';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { ApprovalAction } from './leave-enums';

/** One recorded step in a leave request's approval chain. */
export interface LeaveApproval {
  /** Unique surrogate identifier. */
  id: number;
  /** Leave request this step belongs to. */
  leaveRequestId: number;
  /** Employee acting as approver at this step. */
  approverId: number;
  /** Denormalized approver display name. */
  approverName?: string;
  /** Denormalized approver job title. */
  approverDesignation?: string;
  /** Position of this step in the chain (1-based). */
  approvalLevel: number;
  /** Action recorded at this step. */
  action: ApprovalAction;
  /** Approver's comments. */
  comments?: string;
  /** Employee this step was delegated from, if any. */
  delegatedFromId?: number;
  /** Denormalized delegating-employee name. */
  delegatedFromName?: string;
  /** When the action was taken. */
  actionAt?: Date;
  /** Record creation timestamp. */
  createdAt?: Date;
}

/** Payload for an approve / reject / delegate action. */
export interface LeaveApprovalAction {
  /** Employee performing the action. */
  approverId: number;
  /** Optional comments to attach. */
  comments?: string;
  /** Delegate target; set only when delegating. */
  delegateToId?: number;
}

/** Full approval chain for a request. */
export interface ApprovalChainResponse {
  /** Request the chain belongs to. */
  requestId: number;
  /** The chain's approval steps. */
  approvals: LeaveApproval[];
}

/** Result of the can-approve eligibility check. */
export interface CanApproveResponse {
  /** Whether the queried employee may approve. */
  canApprove: boolean;
  /** Explanation when approval is not permitted. */
  reason?: string;
}

/**
 * Parses a raw approval payload into a typed {@link LeaveApproval}.
 *
 * Validates `id`, `leaveRequestId`, and `approverId` as positive ints, defaults
 * `action` to `PENDING`, and hydrates `actionAt` / `createdAt` into `Date`
 * objects.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `LeaveApproval` domain object.
 * @throws {Error} If `id`, `leaveRequestId`, or `approverId` is missing or not a
 *   positive int.
 */
export function parseLeaveApproval(json: any): LeaveApproval {
  return {
    id: parsePositiveInt(json.id, 'parseLeaveApproval.id'),
    leaveRequestId: parsePositiveInt(
      json.leaveRequestId,
      'parseLeaveApproval.leaveRequestId'
    ),
    approverId: parsePositiveInt(
      json.approverId,
      'parseLeaveApproval.approverId'
    ),
    approverName: json.approverName,
    approverDesignation: json.approverDesignation,
    approvalLevel: json.approvalLevel ?? 0,
    action: (json.action as ApprovalAction) ?? ApprovalAction.PENDING,
    comments: json.comments,
    delegatedFromId: json.delegatedFromId,
    delegatedFromName: json.delegatedFromName,
    actionAt: parseUTCDate(json.actionAt) ?? undefined,
    createdAt: parseUTCDate(json.createdAt) ?? undefined,
  };
}

/**
 * Serializes a {@link LeaveApprovalAction} into the backend request body.
 *
 * Always emits `approverId`; `comments` and `delegateToId` are included only
 * when set.
 *
 * @param dto - The approval action to serialize.
 * @returns A plain object matching the backend's expected body shape.
 */
export function approvalActionToJson(dto: LeaveApprovalAction): any {
  const json: any = {
    approverId: dto.approverId,
  };

  if (dto.comments !== undefined) json.comments = dto.comments;
  if (dto.delegateToId !== undefined) json.delegateToId = dto.delegateToId;

  return json;
}
