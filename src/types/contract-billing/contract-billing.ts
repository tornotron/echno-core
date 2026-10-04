/**
 * @module contract-billing
 *
 * Domain types for running account (RA) and milestone billing in the Work
 * Progress module (`MODULE_WORK_PROGRESS`; echno-backend
 * `docs/specs/2026-10-04-ra-milestone-billing.md`).
 *
 * A contractor's bill is raised on a sub-contract and moves Draft, Submitted
 * (joint measurement), Verified, Certified (deduction rules applied, figures
 * frozen) and Approved (handed to finance as a payable), with Returned for
 * correction and Cancelled beside them. An RA bill has one line per BOQ item;
 * a milestone bill claims a percent of one contract milestone. Money is in
 * rupees to two places and quantities to three, as the backend rounds them.
 *
 * The parsers are non-strict: a field the backend adds later never breaks
 * this client. An enum value this client does not know reads as the most
 * cautious member of its set.
 */

import { z } from 'zod';
import {
  backendDate,
  money,
  nullableBoolean,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';

/** How a contract is billed. The first bill on a contract fixes it. */
export enum BillingModel {
  RUNNING_ACCOUNT = 'RUNNING_ACCOUNT',
  MILESTONE = 'MILESTONE',
}

/** Where a bill stands. */
export enum BillStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  CERTIFIED = 'CERTIFIED',
  APPROVED = 'APPROVED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

/** What a commercial adjustment is. GST, variations, extra items and escalation add; the rest deduct. */
export enum DeductionKind {
  RETENTION = 'RETENTION',
  ADVANCE_RECOVERY = 'ADVANCE_RECOVERY',
  PENALTY_LD = 'PENALTY_LD',
  TDS = 'TDS',
  GST = 'GST',
  VARIATION = 'VARIATION',
  EXTRA_ITEM = 'EXTRA_ITEM',
  ESCALATION = 'ESCALATION',
  OTHER = 'OTHER',
}

/** Whether an adjustment adds to the bill or deducts from it. */
export enum AdjustmentEffect {
  ADD = 'ADD',
  DEDUCT = 'DEDUCT',
}

/** A percent of the bill's base, or a fixed amount. */
export enum DeductionBasis {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

/** Where an adjustment line came from. */
export enum AdjustmentSource {
  RULE = 'RULE',
  MANUAL = 'MANUAL',
}

/** The category of a milestone requirement. */
export enum RequirementType {
  SCOPE = 'SCOPE',
  QUALITY_TEST = 'QUALITY_TEST',
  QA_QC = 'QA_QC',
  DOCUMENT = 'DOCUMENT',
  INSPECTION = 'INSPECTION',
}

/** Where a milestone requirement stands. */
export enum RequirementStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

/** Where one RA line stands, derived by the server from its quantities. */
export enum BillLineStatus {
  NOT_CLAIMED = 'NOT_CLAIMED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  PART_ACCEPTED = 'PART_ACCEPTED',
  REJECTED = 'REJECTED',
}

/** What happened to a bill, for its timeline. */
export enum BillEventType {
  CREATED = 'CREATED',
  CLAIM_UPDATED = 'CLAIM_UPDATED',
  SUBMITTED = 'SUBMITTED',
  MEASUREMENT_SAVED = 'MEASUREMENT_SAVED',
  VERIFIED = 'VERIFIED',
  ADJUSTMENTS_UPDATED = 'ADJUSTMENTS_UPDATED',
  CERTIFIED = 'CERTIFIED',
  APPROVED = 'APPROVED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
  DOCUMENT_ADDED = 'DOCUMENT_ADDED',
  DOCUMENT_REMOVED = 'DOCUMENT_REMOVED',
  NOTE = 'NOTE',
}

/** The document types a bill's supporting documents are filed under. */
export const BILL_DOCUMENT_TYPES = ['photo', 'test-report', 'delivery-challan', 'measurement', 'other'] as const;
export type BillDocumentType = (typeof BILL_DOCUMENT_TYPES)[number];

/** Whether a bill's claim can still be edited. */
export function isBillEditable(status: BillStatus): boolean {
  return status === BillStatus.DRAFT || status === BillStatus.RETURNED;
}

/** Whether a bill is still open (not approved or cancelled). */
export function isBillOpen(status: BillStatus): boolean {
  return status !== BillStatus.APPROVED && status !== BillStatus.CANCELLED;
}

// ---------------------------------------------------------------- shapes

/** Organization-wide billing figures for the home page cards. */
export interface BillingOverview {
  openBills: number;
  drafts: number;
  awaitingVerification: number;
  awaitingCertification: number;
  awaitingApproval: number;
  returned: number;
  approvedBills: number;
  /** Gross certified on certified and approved bills. */
  certifiedToDate: number;
  /** Net payable of approved bills. */
  netApprovedToDate: number;
}

/** A bill as a row in a list. */
export interface BillSummary {
  id: string;
  subContractId: number;
  contractName: string;
  contractorName: string;
  projectId: number;
  projectName?: string;
  billNumber: string;
  billingModel: BillingModel;
  status: BillStatus;
  periodFrom?: string;
  periodTo?: string;
  contractMilestoneId?: number;
  milestoneName?: string;
  grossClaimed: number;
  /** Present once certified. */
  grossCertified?: number;
  /** Present once certified. */
  netPayable?: number;
  submittedAt?: string;
  approvedAt?: string;
  createdAt?: string;
}

/** One contract on the billing home page. */
export interface ContractBillingSummary {
  subContractId: number;
  contractRef?: string;
  contractName: string;
  contractorName: string;
  projectId?: number;
  projectName?: string;
  contractValue?: number;
  contractStatus?: string;
  /** Absent until the first bill is opened. */
  billingModel?: BillingModel;
  billCount: number;
  approvedBillCount: number;
  certifiedToDate: number;
  netApprovedToDate: number;
  /** certifiedToDate as a percent of the contract value. */
  billedPercent?: number;
  openBill?: BillSummary;
  lastApprovedAt?: string;
}

/** One line of a contract's bill of quantities. */
export interface BoqItem {
  id: string;
  subContractId: number;
  itemCode: string;
  description: string;
  unit: string;
  contractQuantity: number;
  rate: number;
  amount: number;
  wbsElementId?: number;
  wbsCode?: string;
  sortOrder: number;
  /** Accepted on certified and approved bills so far. */
  certifiedQuantity: number;
  /** A bill uses it, so it cannot be deleted. */
  inUse: boolean;
}

/** A commercial adjustment a contract applies to each certified bill. */
export interface DeductionRule {
  id: string;
  subContractId: number;
  kind: DeductionKind;
  label: string;
  effect: AdjustmentEffect;
  basis: DeductionBasis;
  rate?: number;
  fixedAmount?: number;
  capAmount?: number;
  enabled: boolean;
  sortOrder: number;
  /** Taken (or added) on certified and approved bills so far. */
  appliedToDate: number;
}

/** One thing a contract milestone needs before it can be certified. */
export interface MilestoneRequirement {
  id: string;
  subContractId: number;
  contractMilestoneId: number;
  title: string;
  type: RequirementType;
  description?: string;
  mandatory: boolean;
  dueDate?: string;
  status: RequirementStatus;
  remarks?: string;
  sortOrder: number;
}

/** A contract milestone as billing sees it. */
export interface BillingMilestone {
  id: number;
  name: string;
  description?: string;
  targetDate?: string;
  completionDate?: string;
  status?: string;
  paymentPercentage?: number;
  /** The milestone amount, or its payment percentage of the contract value. */
  value?: number;
  /** Percent certified on certified and approved bills. */
  certifiedPercent: number;
  requirements: MilestoneRequirement[];
}

/** Everything billing holds for one contract. */
export interface ContractBillingDetail {
  summary: ContractBillingSummary;
  retentionPercentage?: number;
  mobilizationAdvance?: number;
  boqItems: BoqItem[];
  boqTotal: number;
  deductionRules: DeductionRule[];
  milestones: BillingMilestone[];
  bills: BillSummary[];
}

/** One BOQ item on an RA bill, with the running account worked out. */
export interface BillLine {
  id: string;
  boqItemId: string;
  itemCode: string;
  description: string;
  unit: string;
  contractQuantity: number;
  rate: number;
  previousQuantity: number;
  claimedQuantity: number;
  measuredQuantity?: number;
  acceptedQuantity?: number;
  cumulativeQuantity: number;
  balanceQuantity: number;
  percentComplete: number;
  thisAmount: number;
  cumulativeAmount: number;
  status: BillLineStatus;
  /** From the inspected progress of the item's schedule activity. */
  suggestedQuantity?: number;
  remarks?: string;
}

/** One commercial adjustment on a bill. */
export interface BillAdjustment {
  /** Absent on a preview line. */
  id?: string;
  ruleId?: string;
  kind: DeductionKind;
  label: string;
  effect: AdjustmentEffect;
  basis: DeductionBasis;
  rate?: number;
  amount: number;
  source: AdjustmentSource;
  /** A rule line worked out on read, before certification freezes it. */
  preview: boolean;
}

/** A running account or milestone bill. */
export interface Bill {
  id: string;
  projectId: number;
  projectName?: string;
  subContractId: number;
  contractRef?: string;
  contractName: string;
  contractorName: string;
  contractValue?: number;
  billingModel: BillingModel;
  billNumber: string;
  status: BillStatus;
  periodFrom?: string;
  periodTo?: string;
  contractMilestoneId?: number;
  milestoneName?: string;
  milestoneTargetDate?: string;
  milestoneValue?: number;
  milestoneCertifiedBeforePercent?: number;
  claimedPercent?: number;
  certifiedPercent?: number;
  contractorReference?: string;
  location?: string;
  measurementDate?: string;
  measuredBy?: string;
  clientRepresentative?: string;
  remarks?: string;
  returnReason?: string;
  lines: BillLine[];
  requirements: MilestoneRequirement[];
  adjustments: BillAdjustment[];
  grossClaimed: number;
  /** Accepted where measured, claimed otherwise; as certified once certified. */
  grossAmount: number;
  additionsTotal: number;
  deductionsTotal: number;
  netPayable: number;
  previousCertified: number;
  cumulativeCertified: number;
  /** True once certified and the figures are frozen. */
  amountsFinal: boolean;
  preparedByName?: string;
  submittedByName?: string;
  submittedAt?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  certifiedByName?: string;
  certifiedAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  selfApproved: boolean;
  payableId?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** One entry on a bill's timeline. */
export interface BillEvent {
  id: string;
  type: BillEventType;
  fromStatus?: BillStatus;
  toStatus?: BillStatus;
  note?: string;
  actorName?: string;
  createdAt?: string;
}

/** A Spring-style page. */
export interface BillingPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ---------------------------------------------------------------- requests

export interface BoqItemRequest {
  itemCode: string;
  description: string;
  unit: string;
  contractQuantity: number;
  rate: number;
  wbsElementId?: number;
  sortOrder?: number;
}

export interface DeductionRuleRequest {
  kind: DeductionKind;
  label: string;
  /** Defaults by kind. */
  effect?: AdjustmentEffect;
  basis: DeductionBasis;
  /** For a PERCENT rule. */
  rate?: number;
  /** For a FIXED rule. */
  fixedAmount?: number;
  capAmount?: number;
  enabled?: boolean;
  sortOrder?: number;
}

export interface MilestoneRequirementRequest {
  title: string;
  type: RequirementType;
  description?: string;
  mandatory?: boolean;
  dueDate?: string;
  status?: RequirementStatus;
  remarks?: string;
  sortOrder?: number;
}

/** Body of `POST /contract-billing/web/bills`. */
export interface CreateBillRequest {
  subContractId: number;
  billingModel: BillingModel;
  /** RA only. */
  periodFrom?: string;
  /** RA only. */
  periodTo?: string;
  /** Milestone only. */
  contractMilestoneId?: number;
  /** Milestone only. */
  claimedPercent?: number;
  contractorReference?: string;
  location?: string;
  remarks?: string;
}

export interface ClaimLineRequest {
  lineId: string;
  claimedQuantity: number;
  remarks?: string;
}

/** Body of `PUT /contract-billing/web/bills/{id}`: replaces the claim. */
export interface UpdateBillRequest {
  periodFrom?: string;
  periodTo?: string;
  claimedPercent?: number;
  contractorReference?: string;
  location?: string;
  remarks?: string;
  /** Lines to change; a line not named keeps its claim. */
  lines?: ClaimLineRequest[];
}

export interface MeasurementLineRequest {
  lineId: string;
  measuredQuantity?: number;
  acceptedQuantity?: number;
  remarks?: string;
}

/** Body of `PUT /contract-billing/web/bills/{id}/measurement`. */
export interface MeasurementRequest {
  measurementDate?: string;
  measuredBy?: string;
  clientRepresentative?: string;
  /** Milestone only. */
  certifiedPercent?: number;
  /** RA only. */
  lines?: MeasurementLineRequest[];
}

export interface ManualAdjustmentRequest {
  kind: DeductionKind;
  label: string;
  /** Defaults by kind. */
  effect?: AdjustmentEffect;
  amount: number;
}

/** Query parameters of `GET /contract-billing/web/bills`. */
export interface BillListParams {
  projectId?: number;
  subContractId?: number;
  status?: BillStatus;
  billingModel?: BillingModel;
  pageNo?: number;
  pageSize?: number;
}

/** Query parameters of `GET /contract-billing/web/contracts`. */
export interface ContractBillingListParams {
  projectId?: number;
  pageNo?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------- parsers

const id = z.union([z.string(), z.number()]);
const numeric = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]);

function oneOf<E extends Record<string, string>>(values: E, fallback: E[keyof E]) {
  return (raw: string | null | undefined): E[keyof E] =>
    Object.values(values).includes(raw as E[keyof E]) ? (raw as E[keyof E]) : fallback;
}

function optionalOneOf<E extends Record<string, string>>(values: E) {
  return (raw: string | null | undefined): E[keyof E] | undefined =>
    raw && Object.values(values).includes(raw as E[keyof E]) ? (raw as E[keyof E]) : undefined;
}

const parseModel = oneOf(BillingModel, BillingModel.RUNNING_ACCOUNT);
const parseOptionalModel = optionalOneOf(BillingModel);
// An unknown status reads as DRAFT: the client then offers no action that
// needs a later stage, and the server still refuses anything out of turn.
const parseStatus = oneOf(BillStatus, BillStatus.DRAFT);
const parseOptionalStatus = optionalOneOf(BillStatus);
const parseKind = oneOf(DeductionKind, DeductionKind.OTHER);
const parseEffect = oneOf(AdjustmentEffect, AdjustmentEffect.DEDUCT);
const parseBasis = oneOf(DeductionBasis, DeductionBasis.FIXED);
const parseSource = oneOf(AdjustmentSource, AdjustmentSource.MANUAL);
const parseRequirementType = oneOf(RequirementType, RequirementType.SCOPE);
const parseRequirementStatus = oneOf(RequirementStatus, RequirementStatus.PENDING);
const parseLineStatus = oneOf(BillLineStatus, BillLineStatus.UNDER_REVIEW);
const parseEventType = oneOf(BillEventType, BillEventType.NOTE);

const OverviewSchema = z.object({
  openBills: nullableNumber,
  drafts: nullableNumber,
  awaitingVerification: nullableNumber,
  awaitingCertification: nullableNumber,
  awaitingApproval: nullableNumber,
  returned: nullableNumber,
  approvedBills: nullableNumber,
  certifiedToDate: money,
  netApprovedToDate: money,
});

/** Parses the home page figures. */
export function parseBillingOverview(json: unknown): BillingOverview {
  const raw = OverviewSchema.parse(json);
  return {
    openBills: raw.openBills ?? 0,
    drafts: raw.drafts ?? 0,
    awaitingVerification: raw.awaitingVerification ?? 0,
    awaitingCertification: raw.awaitingCertification ?? 0,
    awaitingApproval: raw.awaitingApproval ?? 0,
    returned: raw.returned ?? 0,
    approvedBills: raw.approvedBills ?? 0,
    certifiedToDate: raw.certifiedToDate ?? 0,
    netApprovedToDate: raw.netApprovedToDate ?? 0,
  };
}

const BillSummarySchema = z.object({
  id,
  subContractId: numeric.nullish(),
  contractName: nullableString,
  contractorName: nullableString,
  projectId: numeric.nullish(),
  projectName: nullableString,
  billNumber: nullableString,
  billingModel: nullableString,
  status: nullableString,
  periodFrom: backendDate,
  periodTo: backendDate,
  contractMilestoneId: numeric.nullish(),
  milestoneName: nullableString,
  grossClaimed: money,
  grossCertified: money,
  netPayable: money,
  submittedAt: backendDate,
  approvedAt: backendDate,
  createdAt: backendDate,
});

/** Parses a bill list row. Only `id` is required. */
export function parseBillSummary(json: unknown): BillSummary {
  const raw = BillSummarySchema.parse(json);
  return {
    id: String(raw.id),
    subContractId: raw.subContractId ?? 0,
    contractName: raw.contractName ?? '',
    contractorName: raw.contractorName ?? '',
    projectId: raw.projectId ?? 0,
    projectName: raw.projectName ?? undefined,
    billNumber: raw.billNumber ?? '',
    billingModel: parseModel(raw.billingModel),
    status: parseStatus(raw.status),
    periodFrom: raw.periodFrom ?? undefined,
    periodTo: raw.periodTo ?? undefined,
    contractMilestoneId: raw.contractMilestoneId ?? undefined,
    milestoneName: raw.milestoneName ?? undefined,
    grossClaimed: raw.grossClaimed ?? 0,
    grossCertified: raw.grossCertified ?? undefined,
    netPayable: raw.netPayable ?? undefined,
    submittedAt: raw.submittedAt ?? undefined,
    approvedAt: raw.approvedAt ?? undefined,
    createdAt: raw.createdAt ?? undefined,
  };
}

const ContractSummarySchema = z.object({
  subContractId: numeric,
  contractRef: nullableString,
  contractName: nullableString,
  contractorName: nullableString,
  projectId: numeric.nullish(),
  projectName: nullableString,
  contractValue: money,
  contractStatus: nullableString,
  billingModel: nullableString,
  billCount: nullableNumber,
  approvedBillCount: nullableNumber,
  certifiedToDate: money,
  netApprovedToDate: money,
  billedPercent: money,
  openBill: z.unknown().nullish(),
  lastApprovedAt: backendDate,
});

/** Parses one contract's billing summary. `subContractId` is required. */
export function parseContractBillingSummary(json: unknown): ContractBillingSummary {
  const raw = ContractSummarySchema.parse(json);
  return {
    subContractId: raw.subContractId,
    contractRef: raw.contractRef ?? undefined,
    contractName: raw.contractName ?? '',
    contractorName: raw.contractorName ?? '',
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    contractValue: raw.contractValue ?? undefined,
    contractStatus: raw.contractStatus ?? undefined,
    billingModel: parseOptionalModel(raw.billingModel),
    billCount: raw.billCount ?? 0,
    approvedBillCount: raw.approvedBillCount ?? 0,
    certifiedToDate: raw.certifiedToDate ?? 0,
    netApprovedToDate: raw.netApprovedToDate ?? 0,
    billedPercent: raw.billedPercent ?? undefined,
    openBill: raw.openBill ? parseBillSummary(raw.openBill) : undefined,
    lastApprovedAt: raw.lastApprovedAt ?? undefined,
  };
}

const BoqItemSchema = z.object({
  id,
  subContractId: numeric.nullish(),
  itemCode: nullableString,
  description: nullableString,
  unit: nullableString,
  contractQuantity: money,
  rate: money,
  amount: money,
  wbsElementId: numeric.nullish(),
  wbsCode: nullableString,
  sortOrder: nullableNumber,
  certifiedQuantity: money,
  inUse: nullableBoolean,
});

/** Parses a BOQ item. Only `id` is required. */
export function parseBoqItem(json: unknown): BoqItem {
  const raw = BoqItemSchema.parse(json);
  return {
    id: String(raw.id),
    subContractId: raw.subContractId ?? 0,
    itemCode: raw.itemCode ?? '',
    description: raw.description ?? '',
    unit: raw.unit ?? '',
    contractQuantity: raw.contractQuantity ?? 0,
    rate: raw.rate ?? 0,
    amount: raw.amount ?? 0,
    wbsElementId: raw.wbsElementId ?? undefined,
    wbsCode: raw.wbsCode ?? undefined,
    sortOrder: raw.sortOrder ?? 0,
    certifiedQuantity: raw.certifiedQuantity ?? 0,
    inUse: raw.inUse ?? false,
  };
}

const RuleSchema = z.object({
  id,
  subContractId: numeric.nullish(),
  kind: nullableString,
  label: nullableString,
  effect: nullableString,
  basis: nullableString,
  rate: money,
  fixedAmount: money,
  capAmount: money,
  enabled: nullableBoolean,
  sortOrder: nullableNumber,
  appliedToDate: money,
});

/** Parses a deduction rule. Only `id` is required. */
export function parseDeductionRule(json: unknown): DeductionRule {
  const raw = RuleSchema.parse(json);
  return {
    id: String(raw.id),
    subContractId: raw.subContractId ?? 0,
    kind: parseKind(raw.kind),
    label: raw.label ?? '',
    effect: parseEffect(raw.effect),
    basis: parseBasis(raw.basis),
    rate: raw.rate ?? undefined,
    fixedAmount: raw.fixedAmount ?? undefined,
    capAmount: raw.capAmount ?? undefined,
    enabled: raw.enabled ?? true,
    sortOrder: raw.sortOrder ?? 0,
    appliedToDate: raw.appliedToDate ?? 0,
  };
}

const RequirementSchema = z.object({
  id,
  subContractId: numeric.nullish(),
  contractMilestoneId: numeric.nullish(),
  title: nullableString,
  type: nullableString,
  description: nullableString,
  mandatory: nullableBoolean,
  dueDate: backendDate,
  status: nullableString,
  remarks: nullableString,
  sortOrder: nullableNumber,
});

/** Parses a milestone requirement. Only `id` is required. */
export function parseMilestoneRequirement(json: unknown): MilestoneRequirement {
  const raw = RequirementSchema.parse(json);
  return {
    id: String(raw.id),
    subContractId: raw.subContractId ?? 0,
    contractMilestoneId: raw.contractMilestoneId ?? 0,
    title: raw.title ?? '',
    type: parseRequirementType(raw.type),
    description: raw.description ?? undefined,
    mandatory: raw.mandatory ?? true,
    dueDate: raw.dueDate ?? undefined,
    status: parseRequirementStatus(raw.status),
    remarks: raw.remarks ?? undefined,
    sortOrder: raw.sortOrder ?? 0,
  };
}

const MilestoneSchema = z.object({
  id: numeric,
  name: nullableString,
  description: nullableString,
  targetDate: backendDate,
  completionDate: backendDate,
  status: nullableString,
  paymentPercentage: money,
  value: money,
  certifiedPercent: money,
  requirements: z.array(z.unknown()).nullish(),
});

/** Parses a billing milestone. `id` is required. */
export function parseBillingMilestone(json: unknown): BillingMilestone {
  const raw = MilestoneSchema.parse(json);
  return {
    id: raw.id,
    name: raw.name ?? '',
    description: raw.description ?? undefined,
    targetDate: raw.targetDate ?? undefined,
    completionDate: raw.completionDate ?? undefined,
    status: raw.status ?? undefined,
    paymentPercentage: raw.paymentPercentage ?? undefined,
    value: raw.value ?? undefined,
    certifiedPercent: raw.certifiedPercent ?? 0,
    requirements: (raw.requirements ?? []).map(parseMilestoneRequirement),
  };
}

const DetailSchema = z.object({
  summary: z.unknown(),
  retentionPercentage: money,
  mobilizationAdvance: money,
  boqItems: z.array(z.unknown()).nullish(),
  boqTotal: money,
  deductionRules: z.array(z.unknown()).nullish(),
  milestones: z.array(z.unknown()).nullish(),
  bills: z.array(z.unknown()).nullish(),
});

/** Parses one contract's billing. `summary` is required. */
export function parseContractBillingDetail(json: unknown): ContractBillingDetail {
  const raw = DetailSchema.parse(json);
  return {
    summary: parseContractBillingSummary(raw.summary),
    retentionPercentage: raw.retentionPercentage ?? undefined,
    mobilizationAdvance: raw.mobilizationAdvance ?? undefined,
    boqItems: (raw.boqItems ?? []).map(parseBoqItem),
    boqTotal: raw.boqTotal ?? 0,
    deductionRules: (raw.deductionRules ?? []).map(parseDeductionRule),
    milestones: (raw.milestones ?? []).map(parseBillingMilestone),
    bills: (raw.bills ?? []).map(parseBillSummary),
  };
}

const LineSchema = z.object({
  id,
  boqItemId: id.nullish(),
  itemCode: nullableString,
  description: nullableString,
  unit: nullableString,
  contractQuantity: money,
  rate: money,
  previousQuantity: money,
  claimedQuantity: money,
  measuredQuantity: money,
  acceptedQuantity: money,
  cumulativeQuantity: money,
  balanceQuantity: money,
  percentComplete: money,
  thisAmount: money,
  cumulativeAmount: money,
  status: nullableString,
  suggestedQuantity: money,
  remarks: nullableString,
});

function parseLine(json: unknown): BillLine {
  const raw = LineSchema.parse(json);
  return {
    id: String(raw.id),
    boqItemId: raw.boqItemId == null ? '' : String(raw.boqItemId),
    itemCode: raw.itemCode ?? '',
    description: raw.description ?? '',
    unit: raw.unit ?? '',
    contractQuantity: raw.contractQuantity ?? 0,
    rate: raw.rate ?? 0,
    previousQuantity: raw.previousQuantity ?? 0,
    claimedQuantity: raw.claimedQuantity ?? 0,
    measuredQuantity: raw.measuredQuantity ?? undefined,
    acceptedQuantity: raw.acceptedQuantity ?? undefined,
    cumulativeQuantity: raw.cumulativeQuantity ?? 0,
    balanceQuantity: raw.balanceQuantity ?? 0,
    percentComplete: raw.percentComplete ?? 0,
    thisAmount: raw.thisAmount ?? 0,
    cumulativeAmount: raw.cumulativeAmount ?? 0,
    status: parseLineStatus(raw.status),
    suggestedQuantity: raw.suggestedQuantity ?? undefined,
    remarks: raw.remarks ?? undefined,
  };
}

const AdjustmentSchema = z.object({
  id: id.nullish(),
  ruleId: id.nullish(),
  kind: nullableString,
  label: nullableString,
  effect: nullableString,
  basis: nullableString,
  rate: money,
  amount: money,
  source: nullableString,
  preview: nullableBoolean,
});

function parseAdjustment(json: unknown): BillAdjustment {
  const raw = AdjustmentSchema.parse(json);
  return {
    id: raw.id == null ? undefined : String(raw.id),
    ruleId: raw.ruleId == null ? undefined : String(raw.ruleId),
    kind: parseKind(raw.kind),
    label: raw.label ?? '',
    effect: parseEffect(raw.effect),
    basis: parseBasis(raw.basis),
    rate: raw.rate ?? undefined,
    amount: raw.amount ?? 0,
    source: parseSource(raw.source),
    preview: raw.preview ?? false,
  };
}

const BillSchema = BillSummarySchema.extend({
  contractRef: nullableString,
  contractValue: money,
  milestoneTargetDate: backendDate,
  milestoneValue: money,
  milestoneCertifiedBeforePercent: money,
  claimedPercent: money,
  certifiedPercent: money,
  contractorReference: nullableString,
  location: nullableString,
  measurementDate: backendDate,
  measuredBy: nullableString,
  clientRepresentative: nullableString,
  remarks: nullableString,
  returnReason: nullableString,
  lines: z.array(z.unknown()).nullish(),
  requirements: z.array(z.unknown()).nullish(),
  adjustments: z.array(z.unknown()).nullish(),
  grossAmount: money,
  additionsTotal: money,
  deductionsTotal: money,
  previousCertified: money,
  cumulativeCertified: money,
  amountsFinal: nullableBoolean,
  preparedByName: nullableString,
  submittedByName: nullableString,
  verifiedByName: nullableString,
  verifiedAt: backendDate,
  certifiedByName: nullableString,
  certifiedAt: backendDate,
  approvedByName: nullableString,
  selfApproved: nullableBoolean,
  payableId: numeric.nullish(),
  updatedAt: backendDate,
});

/** Parses a full bill. Only `id` is required. */
export function parseBill(json: unknown): Bill {
  const raw = BillSchema.parse(json);
  return {
    id: String(raw.id),
    projectId: raw.projectId ?? 0,
    projectName: raw.projectName ?? undefined,
    subContractId: raw.subContractId ?? 0,
    contractRef: raw.contractRef ?? undefined,
    contractName: raw.contractName ?? '',
    contractorName: raw.contractorName ?? '',
    contractValue: raw.contractValue ?? undefined,
    billingModel: parseModel(raw.billingModel),
    billNumber: raw.billNumber ?? '',
    status: parseStatus(raw.status),
    periodFrom: raw.periodFrom ?? undefined,
    periodTo: raw.periodTo ?? undefined,
    contractMilestoneId: raw.contractMilestoneId ?? undefined,
    milestoneName: raw.milestoneName ?? undefined,
    milestoneTargetDate: raw.milestoneTargetDate ?? undefined,
    milestoneValue: raw.milestoneValue ?? undefined,
    milestoneCertifiedBeforePercent: raw.milestoneCertifiedBeforePercent ?? undefined,
    claimedPercent: raw.claimedPercent ?? undefined,
    certifiedPercent: raw.certifiedPercent ?? undefined,
    contractorReference: raw.contractorReference ?? undefined,
    location: raw.location ?? undefined,
    measurementDate: raw.measurementDate ?? undefined,
    measuredBy: raw.measuredBy ?? undefined,
    clientRepresentative: raw.clientRepresentative ?? undefined,
    remarks: raw.remarks ?? undefined,
    returnReason: raw.returnReason ?? undefined,
    lines: (raw.lines ?? []).map(parseLine),
    requirements: (raw.requirements ?? []).map(parseMilestoneRequirement),
    adjustments: (raw.adjustments ?? []).map(parseAdjustment),
    grossClaimed: raw.grossClaimed ?? 0,
    grossAmount: raw.grossAmount ?? 0,
    additionsTotal: raw.additionsTotal ?? 0,
    deductionsTotal: raw.deductionsTotal ?? 0,
    netPayable: raw.netPayable ?? 0,
    previousCertified: raw.previousCertified ?? 0,
    cumulativeCertified: raw.cumulativeCertified ?? 0,
    amountsFinal: raw.amountsFinal ?? false,
    preparedByName: raw.preparedByName ?? undefined,
    submittedByName: raw.submittedByName ?? undefined,
    submittedAt: raw.submittedAt ?? undefined,
    verifiedByName: raw.verifiedByName ?? undefined,
    verifiedAt: raw.verifiedAt ?? undefined,
    certifiedByName: raw.certifiedByName ?? undefined,
    certifiedAt: raw.certifiedAt ?? undefined,
    approvedByName: raw.approvedByName ?? undefined,
    approvedAt: raw.approvedAt ?? undefined,
    selfApproved: raw.selfApproved ?? false,
    payableId: raw.payableId ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

const EventSchema = z.object({
  id,
  type: nullableString,
  fromStatus: nullableString,
  toStatus: nullableString,
  note: nullableString,
  actorName: nullableString,
  createdAt: backendDate,
});

/** Parses a timeline entry. Only `id` is required. */
export function parseBillEvent(json: unknown): BillEvent {
  const raw = EventSchema.parse(json);
  return {
    id: String(raw.id),
    type: parseEventType(raw.type),
    fromStatus: parseOptionalStatus(raw.fromStatus),
    toStatus: parseOptionalStatus(raw.toStatus),
    note: raw.note ?? undefined,
    actorName: raw.actorName ?? undefined,
    createdAt: raw.createdAt ?? undefined,
  };
}

const PageSchema = z.object({
  content: z.array(z.unknown()).nullish(),
  page: nullableNumber,
  number: nullableNumber,
  size: nullableNumber,
  totalElements: nullableNumber,
  totalPages: nullableNumber,
});

/** Parses a Spring-style page with the given row parser. Accepts `page` or `number` for the index. */
export function parseBillingPage<T>(json: unknown, parseRow: (raw: unknown) => T): BillingPage<T> {
  const raw = PageSchema.parse(json);
  const content = (raw.content ?? []).map(parseRow);
  return {
    content,
    page: raw.page ?? raw.number ?? 0,
    size: raw.size ?? content.length,
    totalElements: raw.totalElements ?? content.length,
    totalPages: raw.totalPages ?? (content.length > 0 ? 1 : 0),
  };
}
