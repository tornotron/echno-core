/**
 * @module billing
 *
 * Billing domain types: the plan catalog, the organization's subscription
 * (the entitlement projection of spec
 * `echno-backend/docs/specs/2026-08-26-payment-integration-razorpay.md`,
 * section 5), feature access, and the checkout / mandate contract the web
 * app drives Razorpay Checkout.js with (section 9).
 *
 * The plan, subscription and feature-access shapes match the backend DTOs
 * as merged in tornotron/echno-backend#799 and #800. The provider fields on
 * {@link Subscription} and the whole checkout contract ({@link
 * BillingProviderInfo}, {@link CheckoutSession}, {@link Mandate},
 * {@link BillingEventSummary}) are the Phase 2 backend surface the web
 * needs; every one of them parses non-strictly, so a backend that does not
 * send them yet yields the "not configured" defaults rather than a failure.
 */

import { z } from 'zod';
import {
  backendDate,
  nullableBoolean,
  nullableNumber,
  nullableString,
  numericId,
} from '../../lib/validation/backend-schema';

// ---------------------------------------------------------------------------
// Enums (normalised, never provider vocabulary; spec section 3.2)
// ---------------------------------------------------------------------------

/** Lifecycle states of an organization's subscription, as the backend projects them. */
export const SUBSCRIPTION_STATUSES = [
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'PAUSED',
  'EXPIRED',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Billing cycle of a plan. */
export const BILLING_PERIODS = ['MONTHLY', 'ANNUAL'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** How a plan feature is metered. */
export const FEATURE_TYPES = ['BOOLEAN', 'QUOTA', 'RATE_LIMIT'] as const;
export type FeatureType = (typeof FEATURE_TYPES)[number];

/** The window a quota resets over. */
export const QUOTA_PERIODS = [
  'HOURLY',
  'DAILY',
  'MONTHLY',
  'ANNUAL',
  'TOTAL',
  'PER_REQUEST',
] as const;
export type QuotaPeriod = (typeof QUOTA_PERIODS)[number];

/** The payment provider the backend is wired to. `NONE` means checkout is unavailable. */
export const BILLING_PROVIDERS = ['NONE', 'RAZORPAY'] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

/** Normalised mandate lifecycle (spec section 3.2). */
export const MANDATE_STATUSES = [
  'CREATED',
  'PENDING',
  'AUTHORIZED',
  'PAUSED',
  'REVOKED',
  'EXPIRED',
] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];

/** The instrument a recurring mandate was registered on. */
export const MANDATE_METHODS = ['UPI_AUTOPAY', 'ENACH', 'CARD', 'UNKNOWN'] as const;
export type MandateMethod = (typeof MANDATE_METHODS)[number];

/**
 * The RBI additional-factor-authentication ceiling per recurring debit, in
 * paise (15,000 rupees). A cycle amount above it needs the buyer's approval
 * on every charge (spec section 7). The backend reports its configured value
 * in {@link BillingProviderInfo.afaCapPaise}; this is the documented default.
 */
export const DEFAULT_AFA_CAP_PAISE = 1_500_000;

/** Hours of notice the buyer gets before each recurring debit (spec section 7). */
export const PRE_DEBIT_NOTICE_HOURS = 24;

// ---------------------------------------------------------------------------
// Plan catalog
// ---------------------------------------------------------------------------

/** A feature a plan grants, with its quota when metered. */
export interface PlanFeature {
  id: number;
  /** Feature key, e.g. `'MODULE_INSPECTIONS'`. */
  featureCode: string;
  featureName: string;
  featureType: FeatureType;
  /** Quota ceiling for `QUOTA` / `RATE_LIMIT` features; `null` for boolean ones. */
  quotaLimit: number | null;
  quotaPeriod: QuotaPeriod | null;
  enabled: boolean;
}

/** A plan in the catalog. Prices are in rupees as the backend stores them. */
export interface Plan {
  id: number;
  /** Stable plan code, e.g. `'STARTER'`. */
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  trialDays: number;
  /** Seat ceiling; `null` means unlimited. */
  maxUsers: number | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  features: PlanFeature[];
}

/** A feature the backend knows about. */
export interface Feature {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  featureType: FeatureType;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Subscription (the entitlement projection)
// ---------------------------------------------------------------------------

/**
 * The organization's current entitlement. `provider` and
 * `providerSubscriptionId` are set for a gateway-backed row and default to
 * `'NONE'` / `null` for a manually provisioned or trial one.
 */
export interface Subscription {
  id: number;
  organizationId: number | null;
  userId: number | null;
  plan: Plan | null;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  cancellationReason: string | null;
  createdAt: string | null;
  /** Backend's own verdict: the row grants access right now. */
  active: boolean;
  inTrial: boolean;
  expired: boolean;
  provider: BillingProvider;
  providerSubscriptionId: string | null;
  /** When the next recurring debit is scheduled, when the provider reports it. */
  nextChargeAt: string | null;
}

/** The gate's answer for one feature (`FeatureAccessResultDto`). */
export interface FeatureAccessResult {
  allowed: boolean;
  reason: string | null;
  message: string | null;
  quotaLimit: number | null;
  currentUsage: number | null;
}

// ---------------------------------------------------------------------------
// Checkout contract (Phase 2 backend surface)
// ---------------------------------------------------------------------------

/**
 * What the backend is wired to. `enabled` is false when the provider is
 * `NONE` or its keys are missing; the web disables checkout on anything but
 * `enabled === true`.
 */
export interface BillingProviderInfo {
  provider: BillingProvider;
  enabled: boolean;
  /** Public key id for Checkout.js (`rzp_test_...` / `rzp_live_...`); `null` when not configured. */
  keyId: string | null;
  currency: string;
  afaCapPaise: number;
  preDebitNoticeHours: number;
}

/** The e-mandate terms a recurring checkout registers, shown to the buyer before Checkout.js opens. */
export interface CheckoutMandateTerms {
  /** Ceiling the mandate is registered for, in paise. */
  amountCapPaise: number;
  preDebitNoticeHours: number;
  method: MandateMethod;
  /** True when the cycle amount is above the AFA cap, so each charge needs the buyer's approval. */
  perChargeApproval: boolean;
}

/**
 * A checkout the backend has opened with the provider. Exactly one of
 * `providerSubscriptionId` (recurring) or `providerOrderId` (one-off) is
 * set; Checkout.js takes whichever is present together with `keyId`.
 */
export interface CheckoutSession {
  provider: BillingProvider;
  keyId: string;
  providerSubscriptionId: string | null;
  providerOrderId: string | null;
  planCode: string;
  billingPeriod: BillingPeriod;
  /** Cycle amount in paise. */
  amountPaise: number;
  currency: string;
  recurring: boolean;
  /** Hosted authorization page, when the provider issues one as an alternative to Checkout.js. */
  authUrl: string | null;
  customerEmail: string | null;
  customerContact: string | null;
  mandate: CheckoutMandateTerms | null;
}

/** A registered recurring mandate. */
export interface Mandate {
  id: number;
  provider: BillingProvider;
  providerMandateRef: string | null;
  providerSubscriptionId: string | null;
  method: MandateMethod;
  status: MandateStatus;
  maxAmountPaise: number | null;
  authorizedAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
}

/** One billing event as shown in the invoice / payment history. */
export interface BillingEventSummary {
  id: number;
  eventType: string;
  providerEventId: string | null;
  occurredAt: string | null;
  amountPaise: number | null;
  currency: string | null;
  /** Provider invoice or payment reference, when the event carries one. */
  reference: string | null;
  status: string | null;
  description: string | null;
}

// Requests -------------------------------------------------------------------

export interface CreateSubscriptionRequest {
  planCode: string;
  billingPeriod?: BillingPeriod;
}

export interface ChangePlanRequest {
  newPlanCode: string;
}

export interface CancelSubscriptionRequest {
  immediate?: boolean;
  reason?: string;
}

export interface CreateCheckoutSessionRequest {
  planCode: string;
  billingPeriod: BillingPeriod;
  /** The buyer accepted per-charge approval for a cycle amount above the AFA cap. */
  acceptPerChargeAfa?: boolean;
}

/** The handler payload Checkout.js returns on success, sent for server-side verification. */
export interface VerifyCheckoutRequest {
  providerPaymentId: string;
  providerSignature: string;
  providerSubscriptionId?: string;
  providerOrderId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The amount one cycle of `plan` costs for `period`, in paise. */
export function planCycleAmountPaise(plan: Plan, period: BillingPeriod): number {
  const rupees = period === 'ANNUAL' ? plan.annualPrice : plan.monthlyPrice;
  return Math.round(rupees * 100);
}

/**
 * Whether a cycle of `plan` on `period` is above the AFA cap, so the buyer
 * approves every charge (spec section 7).
 */
export function exceedsAfaCap(
  plan: Plan,
  period: BillingPeriod,
  afaCapPaise: number = DEFAULT_AFA_CAP_PAISE
): boolean {
  return planCycleAmountPaise(plan, period) > afaCapPaise;
}

/** Whether `plan` grants `featureCode` (an enabled plan feature). */
export function planIncludesFeature(plan: Plan, featureCode: string): boolean {
  return plan.features.some((f) => f.enabled && f.featureCode === featureCode);
}

/** Whether a subscription in `status` keeps access. `PAST_DUE` is the dunning window (grace). */
export function isEntitledStatus(status: SubscriptionStatus): boolean {
  return status === 'ACTIVE' || status === 'TRIALING' || status === 'PAST_DUE';
}

// ---------------------------------------------------------------------------
// Parsers (non-strict: unknown keys stripped, absent optionals defaulted)
// ---------------------------------------------------------------------------

function enumOr<T extends readonly string[]>(values: T, fallback: T[number]) {
  return z
    .string()
    .nullish()
    .transform((v) => (v && (values as readonly string[]).includes(v) ? (v as T[number]) : fallback));
}

const PlanFeatureResponseSchema = z.object({
  id: numericId,
  featureCode: nullableString,
  featureName: nullableString,
  featureType: enumOr(FEATURE_TYPES, 'BOOLEAN'),
  quotaLimit: nullableNumber,
  quotaPeriod: z
    .string()
    .nullish()
    .transform((v) =>
      v && (QUOTA_PERIODS as readonly string[]).includes(v) ? (v as QuotaPeriod) : null
    ),
  enabled: nullableBoolean,
});

const PlanResponseSchema = z.object({
  id: numericId,
  code: z.string().min(1),
  name: nullableString,
  description: nullableString,
  monthlyPrice: z.coerce.number().nullish(),
  annualPrice: z.coerce.number().nullish(),
  currency: nullableString,
  trialDays: nullableNumber,
  maxUsers: nullableNumber,
  isActive: nullableBoolean,
  isPublic: nullableBoolean,
  sortOrder: nullableNumber,
  features: z.array(PlanFeatureResponseSchema).nullish(),
});

const FeatureResponseSchema = z.object({
  id: numericId,
  code: z.string().min(1),
  name: nullableString,
  description: nullableString,
  category: nullableString,
  featureType: enumOr(FEATURE_TYPES, 'BOOLEAN'),
  isActive: nullableBoolean,
});

const SubscriptionResponseSchema = z.object({
  id: numericId,
  organizationId: nullableNumber,
  userId: nullableNumber,
  plan: PlanResponseSchema.nullish(),
  status: enumOr(SUBSCRIPTION_STATUSES, 'INCOMPLETE'),
  currentPeriodStart: backendDate,
  currentPeriodEnd: backendDate,
  trialStart: backendDate,
  trialEnd: backendDate,
  cancelAtPeriodEnd: nullableBoolean,
  canceledAt: backendDate,
  cancellationReason: nullableString,
  createdAt: backendDate,
  active: nullableBoolean,
  inTrial: nullableBoolean,
  expired: nullableBoolean,
  provider: enumOr(BILLING_PROVIDERS, 'NONE'),
  providerSubscriptionId: nullableString,
  nextChargeAt: backendDate,
});

const FeatureAccessResultResponseSchema = z.object({
  allowed: nullableBoolean,
  reason: nullableString,
  message: nullableString,
  quotaLimit: nullableNumber,
  currentUsage: nullableNumber,
});

const BillingProviderInfoResponseSchema = z.object({
  provider: enumOr(BILLING_PROVIDERS, 'NONE'),
  enabled: nullableBoolean,
  keyId: nullableString,
  currency: nullableString,
  afaCapPaise: nullableNumber,
  preDebitNoticeHours: nullableNumber,
});

const CheckoutMandateTermsResponseSchema = z.object({
  amountCapPaise: nullableNumber,
  preDebitNoticeHours: nullableNumber,
  method: enumOr(MANDATE_METHODS, 'UNKNOWN'),
  perChargeApproval: nullableBoolean,
});

const CheckoutSessionResponseSchema = z.object({
  provider: enumOr(BILLING_PROVIDERS, 'NONE'),
  keyId: z.string().min(1),
  providerSubscriptionId: nullableString,
  providerOrderId: nullableString,
  planCode: nullableString,
  billingPeriod: enumOr(BILLING_PERIODS, 'MONTHLY'),
  amountPaise: nullableNumber,
  currency: nullableString,
  recurring: nullableBoolean,
  authUrl: nullableString,
  customerEmail: nullableString,
  customerContact: nullableString,
  mandate: CheckoutMandateTermsResponseSchema.nullish(),
});

const MandateResponseSchema = z.object({
  id: numericId,
  provider: enumOr(BILLING_PROVIDERS, 'NONE'),
  providerMandateRef: nullableString,
  providerSubscriptionId: nullableString,
  method: enumOr(MANDATE_METHODS, 'UNKNOWN'),
  status: enumOr(MANDATE_STATUSES, 'CREATED'),
  maxAmountPaise: nullableNumber,
  authorizedAt: backendDate,
  revokedAt: backendDate,
  createdAt: backendDate,
});

const BillingEventSummaryResponseSchema = z.object({
  id: numericId,
  eventType: nullableString,
  providerEventId: nullableString,
  occurredAt: backendDate,
  amountPaise: nullableNumber,
  currency: nullableString,
  reference: nullableString,
  status: nullableString,
  description: nullableString,
});

/** Parses a `PlanFeatureDto`. Throws when `id` is missing. */
export function parsePlanFeature(json: unknown): PlanFeature {
  const raw = PlanFeatureResponseSchema.parse(json);
  return {
    id: raw.id,
    featureCode: raw.featureCode ?? '',
    featureName: raw.featureName ?? raw.featureCode ?? '',
    featureType: raw.featureType,
    quotaLimit: raw.quotaLimit ?? null,
    quotaPeriod: raw.quotaPeriod ?? null,
    enabled: raw.enabled ?? true,
  };
}

/** Parses a `PlanDto`. Throws when `id` or `code` is missing. */
export function parsePlan(json: unknown): Plan {
  const raw = PlanResponseSchema.parse(json);
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name ?? raw.code,
    description: raw.description ?? '',
    monthlyPrice: raw.monthlyPrice ?? 0,
    annualPrice: raw.annualPrice ?? 0,
    currency: raw.currency ?? 'INR',
    trialDays: raw.trialDays ?? 0,
    maxUsers: raw.maxUsers ?? null,
    isActive: raw.isActive ?? true,
    isPublic: raw.isPublic ?? false,
    sortOrder: raw.sortOrder ?? 0,
    features: (raw.features ?? []).map((f) => parsePlanFeature(f)),
  };
}

/** Parses a `FeatureDto`. Throws when `id` or `code` is missing. */
export function parseFeature(json: unknown): Feature {
  const raw = FeatureResponseSchema.parse(json);
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name ?? raw.code,
    description: raw.description ?? '',
    category: raw.category ?? '',
    featureType: raw.featureType,
    isActive: raw.isActive ?? true,
  };
}

/**
 * Parses a `SubscriptionDto`. An unknown `status` parses as `INCOMPLETE`
 * (never as entitled); missing provider fields mean a manual row.
 */
export function parseSubscription(json: unknown): Subscription {
  const raw = SubscriptionResponseSchema.parse(json);
  const status = raw.status;
  return {
    id: raw.id,
    organizationId: raw.organizationId ?? null,
    userId: raw.userId ?? null,
    plan: raw.plan ? parsePlan(raw.plan) : null,
    status,
    currentPeriodStart: raw.currentPeriodStart ?? null,
    currentPeriodEnd: raw.currentPeriodEnd ?? null,
    trialStart: raw.trialStart ?? null,
    trialEnd: raw.trialEnd ?? null,
    cancelAtPeriodEnd: raw.cancelAtPeriodEnd ?? false,
    canceledAt: raw.canceledAt ?? null,
    cancellationReason: raw.cancellationReason ?? null,
    createdAt: raw.createdAt ?? null,
    active: raw.active ?? (status === 'ACTIVE' || status === 'TRIALING'),
    inTrial: raw.inTrial ?? status === 'TRIALING',
    expired: raw.expired ?? status === 'EXPIRED',
    provider: raw.provider,
    providerSubscriptionId: raw.providerSubscriptionId ?? null,
    nextChargeAt: raw.nextChargeAt ?? null,
  };
}

/** Parses a `FeatureAccessResultDto`. A missing `allowed` is a denial. */
export function parseFeatureAccessResult(json: unknown): FeatureAccessResult {
  const raw = FeatureAccessResultResponseSchema.parse(json);
  return {
    allowed: raw.allowed ?? false,
    reason: raw.reason ?? null,
    message: raw.message ?? null,
    quotaLimit: raw.quotaLimit ?? null,
    currentUsage: raw.currentUsage ?? null,
  };
}

/** The provider info a backend with no gateway reports. */
export const BILLING_NOT_CONFIGURED: BillingProviderInfo = {
  provider: 'NONE',
  enabled: false,
  keyId: null,
  currency: 'INR',
  afaCapPaise: DEFAULT_AFA_CAP_PAISE,
  preDebitNoticeHours: PRE_DEBIT_NOTICE_HOURS,
};

/**
 * Parses the provider info. `enabled` is true only when the backend says so
 * AND names a provider other than `NONE` with a key id, so a half-configured
 * backend never turns checkout on.
 */
export function parseBillingProviderInfo(json: unknown): BillingProviderInfo {
  const raw = BillingProviderInfoResponseSchema.parse(json);
  const keyId = raw.keyId ?? null;
  return {
    provider: raw.provider,
    enabled: raw.enabled === true && raw.provider !== 'NONE' && keyId !== null && keyId !== '',
    keyId,
    currency: raw.currency ?? 'INR',
    afaCapPaise: raw.afaCapPaise ?? DEFAULT_AFA_CAP_PAISE,
    preDebitNoticeHours: raw.preDebitNoticeHours ?? PRE_DEBIT_NOTICE_HOURS,
  };
}

/** Parses a checkout session. Throws when `keyId` is missing or neither provider id is set. */
export function parseCheckoutSession(json: unknown): CheckoutSession {
  const raw = CheckoutSessionResponseSchema.parse(json);
  const providerSubscriptionId = raw.providerSubscriptionId ?? null;
  const providerOrderId = raw.providerOrderId ?? null;
  if (!providerSubscriptionId && !providerOrderId) {
    throw new Error('Checkout session carries neither a subscription id nor an order id');
  }
  const amountPaise = raw.amountPaise ?? 0;
  const mandate = raw.mandate
    ? {
        amountCapPaise: raw.mandate.amountCapPaise ?? amountPaise,
        preDebitNoticeHours: raw.mandate.preDebitNoticeHours ?? PRE_DEBIT_NOTICE_HOURS,
        method: raw.mandate.method,
        perChargeApproval: raw.mandate.perChargeApproval ?? amountPaise > DEFAULT_AFA_CAP_PAISE,
      }
    : null;
  return {
    provider: raw.provider,
    keyId: raw.keyId,
    providerSubscriptionId,
    providerOrderId,
    planCode: raw.planCode ?? '',
    billingPeriod: raw.billingPeriod,
    amountPaise,
    currency: raw.currency ?? 'INR',
    recurring: raw.recurring ?? providerSubscriptionId !== null,
    authUrl: raw.authUrl ?? null,
    customerEmail: raw.customerEmail ?? null,
    customerContact: raw.customerContact ?? null,
    mandate,
  };
}

/** Parses a mandate row. */
export function parseMandate(json: unknown): Mandate {
  const raw = MandateResponseSchema.parse(json);
  return {
    id: raw.id,
    provider: raw.provider,
    providerMandateRef: raw.providerMandateRef ?? null,
    providerSubscriptionId: raw.providerSubscriptionId ?? null,
    method: raw.method,
    status: raw.status,
    maxAmountPaise: raw.maxAmountPaise ?? null,
    authorizedAt: raw.authorizedAt ?? null,
    revokedAt: raw.revokedAt ?? null,
    createdAt: raw.createdAt ?? null,
  };
}

/** Parses a billing event summary. */
export function parseBillingEventSummary(json: unknown): BillingEventSummary {
  const raw = BillingEventSummaryResponseSchema.parse(json);
  return {
    id: raw.id,
    eventType: raw.eventType ?? '',
    providerEventId: raw.providerEventId ?? null,
    occurredAt: raw.occurredAt ?? null,
    amountPaise: raw.amountPaise ?? null,
    currency: raw.currency ?? null,
    reference: raw.reference ?? null,
    status: raw.status ?? null,
    description: raw.description ?? null,
  };
}
