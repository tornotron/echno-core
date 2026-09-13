/**
 * @module use-billing-mutations
 *
 * Mutation hooks for checkout and subscription changes. Every one of them
 * invalidates the whole billing namespace (subscription, feature access,
 * mandate, events) and the module registry's enabled set, since a plan
 * change is what turns a paid module on or off.
 */

import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingService } from '../../services/billing-service';
import { moduleKeys } from '../module/keys';
import {
  CancelSubscriptionRequest,
  ChangePlanRequest,
  CreateCheckoutSessionRequest,
  CreateSubscriptionRequest,
  VerifyCheckoutRequest,
} from '../../types/billing/billing';
import { billingKeys } from './keys';

/**
 * Invalidates everything an entitlement change can affect: the billing
 * namespace and the enabled-module set. Exported so a caller that learns of
 * a change out of band (a webhook-driven status flip seen while polling)
 * can refresh the same surfaces.
 */
export async function invalidateEntitlements(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: billingKeys.all }),
    queryClient.invalidateQueries({ queryKey: moduleKeys.all }),
  ]);
}

/** Opens a checkout with the provider. Nothing to invalidate until it is verified. */
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (req: CreateCheckoutSessionRequest) => billingService.createCheckoutSession(req),
  });
}

/** Sends the Checkout.js success payload for server-side verification. */
export function useVerifyCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: VerifyCheckoutRequest) => billingService.verifyCheckout(req),
    onSuccess: () => invalidateEntitlements(queryClient),
  });
}

/** Provisions a subscription without a gateway (free tier, trial, admin override). */
export function useCreateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateSubscriptionRequest) => billingService.createSubscription(req),
    onSuccess: () => invalidateEntitlements(queryClient),
  });
}

/** Moves the organization to another plan. */
export function useChangePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: ChangePlanRequest) => billingService.changePlan(req),
    onSuccess: () => invalidateEntitlements(queryClient),
  });
}

/** Cancels the organization's subscription, at period end unless `immediate`. */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CancelSubscriptionRequest = {}) => billingService.cancelSubscription(req),
    onSuccess: () => invalidateEntitlements(queryClient),
  });
}
