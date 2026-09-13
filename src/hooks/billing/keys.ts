/**
 * TanStack Query key factory for the Billing domain.
 *
 * Key shapes:
 * - `['billing']` — namespace root; the invalidation prefix after any
 *   checkout or subscription change.
 * - `['billing', 'plans']` — the public plan catalog.
 * - `['billing', 'plans', code]` — one plan.
 * - `['billing', 'subscription']` — the organization's current subscription.
 * - `['billing', 'subscription', 'history']` — every row the organization had.
 * - `['billing', 'feature-access', featureCode]` — the gate's answer for one feature.
 * - `['billing', 'provider']` — which gateway the backend is wired to.
 * - `['billing', 'mandate']` — the organization's recurring mandate.
 * - `['billing', 'events']` — charges, invoices and failures.
 */
export const billingKeys = {
  all: ['billing'] as const,
  plans: () => [...billingKeys.all, 'plans'] as const,
  plan: (code: string) => [...billingKeys.plans(), code] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  history: () => [...billingKeys.subscription(), 'history'] as const,
  featureAccess: (featureCode: string) =>
    [...billingKeys.all, 'feature-access', featureCode] as const,
  provider: () => [...billingKeys.all, 'provider'] as const,
  mandate: () => [...billingKeys.all, 'mandate'] as const,
  events: () => [...billingKeys.all, 'events'] as const,
};
