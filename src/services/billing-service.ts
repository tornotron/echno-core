/**
 * @module billing-service
 *
 * Typed client for the billing endpoints: plan catalog, the organization's
 * subscription and feature access (tornotron/echno-backend#799, #800), and
 * the checkout / mandate / history contract the web checkout drives.
 *
 * Every function throws {@link ApiError} on a non-2xx response or a parse
 * failure. The two "current" reads (`getCurrentSubscription`, `getMandate`)
 * return `null` on the backend's 204, which the client surfaces as an empty
 * body rather than an `ApiError`.
 *
 * Checkout paths (`/billing/checkout/web/*`, `/billing/events/web`) are the
 * Phase 2 backend surface; until it lands they fail like any other missing
 * endpoint, and the hooks treat that as "billing not configured".
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  BillingEventSummary,
  BillingProviderInfo,
  CancelSubscriptionRequest,
  ChangePlanRequest,
  CheckoutSession,
  CreateCheckoutSessionRequest,
  CreateSubscriptionRequest,
  FeatureAccessResult,
  Mandate,
  Plan,
  Subscription,
  VerifyCheckoutRequest,
  parseBillingEventSummary,
  parseBillingProviderInfo,
  parseCheckoutSession,
  parseFeatureAccessResult,
  parseMandate,
  parsePlan,
  parseSubscription,
} from '../types/billing/billing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function parseOrThrow<T>(what: string, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    logger.error(`Failed to parse ${what}:`, error);
    throw new ApiError(`Failed to process ${what}. Please try again.`, 422);
  }
}

function parseList<T>(what: string, data: ApiResponse, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(data)) {
    logger.error(`Failed to parse ${what}:`, new Error(`Expected an array of ${what}`));
    throw new ApiError(`Failed to process ${what}. Please try again.`, 422);
  }
  return parseOrThrow(what, () => data.map((item) => parse(item)));
}

/** A 204 reaches the caller as a body-parse failure, never as an `ApiError`. */
async function nullOnNoContent<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    const data = await read();
    return data === undefined || data === null ? null : data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return null;
  }
}

export const billingService = {
  // Plan catalog -------------------------------------------------------------

  /** `GET /billing/plans/web/public`: the plans a buyer may pick from. */
  async listPublicPlans(): Promise<Plan[]> {
    const data = await api.get<ApiResponse[]>('/billing/plans/web/public');
    return parseList('plans', data, parsePlan);
  },

  /** `GET /billing/plans/web/code/{code}`. */
  async getPlanByCode(code: string): Promise<Plan> {
    const data = await api.get<ApiResponse>(`/billing/plans/web/code/${encodeURIComponent(code)}`);
    return parseOrThrow('plan', () => parsePlan(data));
  },

  // Subscription -------------------------------------------------------------

  /** `GET /billing/subscriptions/web/current`: the organization's live row, or `null` (204). */
  async getCurrentSubscription(): Promise<Subscription | null> {
    const data = await nullOnNoContent(() =>
      api.get<ApiResponse>('/billing/subscriptions/web/current')
    );
    return data === null ? null : parseOrThrow('subscription', () => parseSubscription(data));
  },

  /** `GET /billing/subscriptions/web/history`. */
  async getSubscriptionHistory(): Promise<Subscription[]> {
    const data = await api.get<ApiResponse[]>('/billing/subscriptions/web/history');
    return parseList('subscription history', data, parseSubscription);
  },

  /** `GET /billing/subscriptions/web/features/{featureCode}/access`. */
  async checkFeatureAccess(featureCode: string): Promise<FeatureAccessResult> {
    const data = await api.get<ApiResponse>(
      `/billing/subscriptions/web/features/${encodeURIComponent(featureCode)}/access`
    );
    return parseOrThrow('feature access', () => parseFeatureAccessResult(data));
  },

  /**
   * `POST /billing/subscriptions/web`: a manually provisioned or trial
   * subscription (no gateway). Paid plans go through {@link createCheckoutSession}.
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    const data = await api.post<ApiResponse>('/billing/subscriptions/web', {
      planCode: request.planCode,
      billingPeriod: request.billingPeriod,
    });
    return parseOrThrow('subscription', () => parseSubscription(data));
  },

  /** `PUT /billing/subscriptions/web/change-plan`. */
  async changePlan(request: ChangePlanRequest): Promise<Subscription> {
    const data = await api.put<ApiResponse>('/billing/subscriptions/web/change-plan', {
      newPlanCode: request.newPlanCode,
    });
    return parseOrThrow('subscription', () => parseSubscription(data));
  },

  /** `POST /billing/subscriptions/web/cancel`. */
  async cancelSubscription(request: CancelSubscriptionRequest = {}): Promise<Subscription> {
    const data = await api.post<ApiResponse>('/billing/subscriptions/web/cancel', {
      immediate: request.immediate ?? false,
      reason: request.reason,
    });
    return parseOrThrow('subscription', () => parseSubscription(data));
  },

  // Checkout (Phase 2 backend surface) --------------------------------------

  /** `GET /billing/checkout/web/provider`: which gateway is wired and its public key id. */
  async getProviderInfo(): Promise<BillingProviderInfo> {
    const data = await api.get<ApiResponse>('/billing/checkout/web/provider');
    return parseOrThrow('billing provider', () => parseBillingProviderInfo(data));
  },

  /**
   * `POST /billing/checkout/web/sessions`: opens a provider subscription
   * (recurring) or order (one-off) for the plan and returns the ids
   * Checkout.js needs. Entitlement is never granted here.
   */
  async createCheckoutSession(request: CreateCheckoutSessionRequest): Promise<CheckoutSession> {
    const data = await api.post<ApiResponse>('/billing/checkout/web/sessions', {
      planCode: request.planCode,
      billingPeriod: request.billingPeriod,
      acceptPerChargeAfa: request.acceptPerChargeAfa ?? false,
    });
    return parseOrThrow('checkout session', () => parseCheckoutSession(data));
  },

  /**
   * `POST /billing/checkout/web/verify`: hands the Checkout.js success
   * payload to the backend, which checks the provider signature. The
   * returned row is still `INCOMPLETE` until the webhook activates it.
   */
  async verifyCheckout(request: VerifyCheckoutRequest): Promise<Subscription> {
    const data = await api.post<ApiResponse>('/billing/checkout/web/verify', {
      providerPaymentId: request.providerPaymentId,
      providerSignature: request.providerSignature,
      providerSubscriptionId: request.providerSubscriptionId,
      providerOrderId: request.providerOrderId,
    });
    return parseOrThrow('checkout verification', () => parseSubscription(data));
  },

  /** `GET /billing/checkout/web/mandate`: the organization's mandate, or `null` (204). */
  async getMandate(): Promise<Mandate | null> {
    const data = await nullOnNoContent(() => api.get<ApiResponse>('/billing/checkout/web/mandate'));
    return data === null ? null : parseOrThrow('mandate', () => parseMandate(data));
  },

  /** `GET /billing/events/web`: charges, invoices and failures, newest first. */
  async listBillingEvents(): Promise<BillingEventSummary[]> {
    const data = await api.get<ApiResponse[]>('/billing/events/web');
    return parseList('billing events', data, parseBillingEventSummary);
  },
};
