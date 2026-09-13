/**
 * @module use-billing
 *
 * Query hooks for the billing domain: the plan catalog, the organization's
 * subscription, feature access, the provider info that decides whether
 * checkout is available, the mandate and the billing history.
 */

import { useQuery } from '@tanstack/react-query';
import { billingService } from '../../services/billing-service';
import { standardQueryOptions, staticQueryOptions } from '../../lib/query/options';
import {
  BILLING_NOT_CONFIGURED,
  BillingProviderInfo,
  Plan,
  Subscription,
  SubscriptionStatus,
  isEntitledStatus,
} from '../../types/billing/billing';
import { billingKeys } from './keys';

/** The public plan catalog. Static profile: the catalog changes by deploy, not by session. */
export function usePublicPlans() {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: () => billingService.listPublicPlans(),
    ...staticQueryOptions,
  });
}

/** One plan by code. */
export function usePlan(code: string | null | undefined) {
  return useQuery({
    queryKey: billingKeys.plan(code ?? ''),
    queryFn: () => billingService.getPlanByCode(code as string),
    enabled: !!code,
    ...staticQueryOptions,
  });
}

/**
 * The organization's current subscription, `null` when it has none. Standard
 * profile so a webhook-driven state change (authorization pending to active)
 * shows within a few minutes without a reload; callers that poll after a
 * checkout pass `refetchInterval` through `options`.
 */
export function useCurrentSubscription(options: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: () => billingService.getCurrentSubscription(),
    ...standardQueryOptions,
    refetchInterval: options.refetchInterval ?? false,
  });
}

/** Every subscription row the organization has had, newest first as the backend orders it. */
export function useSubscriptionHistory() {
  return useQuery({
    queryKey: billingKeys.history(),
    queryFn: () => billingService.getSubscriptionHistory(),
    ...standardQueryOptions,
  });
}

/**
 * The gate's answer for one feature code (`FeatureAccessResultDto`). This is
 * presentation only; the server-side `@RequireSubscription` backstop is the
 * control.
 */
export function useFeatureAccess(featureCode: string | null | undefined) {
  return useQuery({
    queryKey: billingKeys.featureAccess(featureCode ?? ''),
    queryFn: () => billingService.checkFeatureAccess(featureCode as string),
    enabled: !!featureCode,
    ...standardQueryOptions,
  });
}

/**
 * Which gateway the backend is wired to. The query never surfaces an error
 * to the caller: a backend that has no provider endpoint, no provider, or
 * missing keys all resolve to {@link BILLING_NOT_CONFIGURED}, so checkout is
 * enabled only on a positive answer. `retry` is off because the answer
 * does not change between attempts within a session.
 */
export function useBillingProvider() {
  return useQuery<BillingProviderInfo>({
    queryKey: billingKeys.provider(),
    queryFn: async () => {
      try {
        return await billingService.getProviderInfo();
      } catch {
        return BILLING_NOT_CONFIGURED;
      }
    },
    ...staticQueryOptions,
    retry: false,
  });
}

/** The organization's recurring mandate, `null` when none is registered. */
export function useMandate(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingKeys.mandate(),
    queryFn: () => billingService.getMandate(),
    enabled: options.enabled ?? true,
    ...standardQueryOptions,
  });
}

/** Charges, invoices and failures for the organization. */
export function useBillingEvents(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingKeys.events(),
    queryFn: () => billingService.listBillingEvents(),
    enabled: options.enabled ?? true,
    ...standardQueryOptions,
  });
}

/** What {@link useEntitlements} derives from the current subscription. */
export interface Entitlements {
  subscription: Subscription | null;
  plan: Plan | null;
  status: SubscriptionStatus | null;
  /** The row grants access now (`ACTIVE`, `TRIALING`, or `PAST_DUE` within grace). */
  entitled: boolean;
  /** Feature codes the plan grants. */
  featureCodes: ReadonlySet<string>;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Bootstrap view of the organization's entitlement, derived from the current
 * subscription. `featureCodes` is what a paywall reads to say which module a
 * plan unlocks; the enabled-module set itself comes from the `module` domain.
 */
export function useEntitlements(): Entitlements {
  const query = useCurrentSubscription();
  const subscription = query.data ?? null;
  const plan = subscription?.plan ?? null;
  const status = subscription?.status ?? null;
  const featureCodes = new Set<string>(
    (plan?.features ?? []).filter((f) => f.enabled).map((f) => f.featureCode)
  );
  return {
    subscription,
    plan,
    status,
    entitled: status !== null && isEntitledStatus(status),
    featureCodes,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
