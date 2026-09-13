import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { billingService } from './billing-service';

afterEach(() => {
  for (const m of ['get', 'post', 'put'] as const) {
    (api[m] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

const subscriptionDto = { id: 7, status: 'ACTIVE', plan: { id: 3, code: 'PRO' } };

describe('billingService plan catalog', () => {
  test('lists public plans from the public endpoint', async () => {
    spyOn(api, 'get').mockResolvedValue([{ id: 1, code: 'FREE' }, { id: 3, code: 'PRO' }]);
    const plans = await billingService.listPublicPlans();
    expect(api.get).toHaveBeenCalledWith('/billing/plans/web/public');
    expect(plans.map((p) => p.code)).toEqual(['FREE', 'PRO']);
  });

  test('throws rather than reporting an empty catalog on a malformed response', async () => {
    spyOn(api, 'get').mockResolvedValue({ not: 'an array' });
    await expect(billingService.listPublicPlans()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('billingService subscription', () => {
  test('a 204 (empty body) on current is null, not an error', async () => {
    spyOn(api, 'get').mockRejectedValue(new SyntaxError('Unexpected end of JSON input'));
    expect(await billingService.getCurrentSubscription()).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/billing/subscriptions/web/current');
  });

  test('an ApiError on current still propagates', async () => {
    spyOn(api, 'get').mockRejectedValue(new ApiError('nope', 403));
    await expect(billingService.getCurrentSubscription()).rejects.toBeInstanceOf(ApiError);
  });

  test('parses the current subscription', async () => {
    spyOn(api, 'get').mockResolvedValue(subscriptionDto);
    const sub = await billingService.getCurrentSubscription();
    expect(sub?.status).toBe('ACTIVE');
    expect(sub?.plan?.code).toBe('PRO');
  });

  test('feature access hits the per-feature access endpoint', async () => {
    spyOn(api, 'get').mockResolvedValue({ allowed: true });
    const result = await billingService.checkFeatureAccess('MODULE_INSPECTIONS');
    expect(api.get).toHaveBeenCalledWith(
      '/billing/subscriptions/web/features/MODULE_INSPECTIONS/access'
    );
    expect(result.allowed).toBe(true);
  });

  test('create, change-plan and cancel send the backend field names', async () => {
    spyOn(api, 'post').mockResolvedValue(subscriptionDto);
    spyOn(api, 'put').mockResolvedValue(subscriptionDto);
    await billingService.createSubscription({ planCode: 'FREE', billingPeriod: 'MONTHLY' });
    expect(api.post).toHaveBeenCalledWith('/billing/subscriptions/web', {
      planCode: 'FREE',
      billingPeriod: 'MONTHLY',
    });
    await billingService.changePlan({ newPlanCode: 'PRO' });
    expect(api.put).toHaveBeenCalledWith('/billing/subscriptions/web/change-plan', {
      newPlanCode: 'PRO',
    });
    await billingService.cancelSubscription({ reason: 'Moving on' });
    expect(api.post).toHaveBeenCalledWith('/billing/subscriptions/web/cancel', {
      immediate: false,
      reason: 'Moving on',
    });
  });
});

describe('billingService checkout', () => {
  test('provider info parses and a none provider is disabled', async () => {
    spyOn(api, 'get').mockResolvedValue({ provider: 'NONE', enabled: false });
    const info = await billingService.getProviderInfo();
    expect(api.get).toHaveBeenCalledWith('/billing/checkout/web/provider');
    expect(info.enabled).toBe(false);
  });

  test('createCheckoutSession posts the plan and period and returns the provider ids', async () => {
    spyOn(api, 'post').mockResolvedValue({
      provider: 'RAZORPAY',
      keyId: 'rzp_test_abc',
      providerSubscriptionId: 'sub_123',
      amountPaise: 999_900,
    });
    const session = await billingService.createCheckoutSession({
      planCode: 'PRO',
      billingPeriod: 'MONTHLY',
    });
    expect(api.post).toHaveBeenCalledWith('/billing/checkout/web/sessions', {
      planCode: 'PRO',
      billingPeriod: 'MONTHLY',
      acceptPerChargeAfa: false,
    });
    expect(session.keyId).toBe('rzp_test_abc');
    expect(session.providerSubscriptionId).toBe('sub_123');
  });

  test('verifyCheckout posts the Checkout.js payload and returns the subscription', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: 7, status: 'INCOMPLETE' });
    const sub = await billingService.verifyCheckout({
      providerPaymentId: 'pay_1',
      providerSignature: 'sig',
      providerSubscriptionId: 'sub_123',
    });
    expect(api.post).toHaveBeenCalledWith('/billing/checkout/web/verify', {
      providerPaymentId: 'pay_1',
      providerSignature: 'sig',
      providerSubscriptionId: 'sub_123',
      providerOrderId: undefined,
    });
    expect(sub.status).toBe('INCOMPLETE');
  });

  test('mandate is null on an empty body', async () => {
    spyOn(api, 'get').mockRejectedValue(new SyntaxError('Unexpected end of JSON input'));
    expect(await billingService.getMandate()).toBeNull();
  });

  test('billing events list parses', async () => {
    spyOn(api, 'get').mockResolvedValue([{ id: 1, eventType: 'subscription.charged', amountPaise: 100 }]);
    const events = await billingService.listBillingEvents();
    expect(api.get).toHaveBeenCalledWith('/billing/events/web');
    expect(events[0].amountPaise).toBe(100);
  });
});
