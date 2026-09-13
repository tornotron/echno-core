import { describe, expect, test } from 'bun:test';
import {
  BILLING_NOT_CONFIGURED,
  DEFAULT_AFA_CAP_PAISE,
  exceedsAfaCap,
  isEntitledStatus,
  parseBillingProviderInfo,
  parseCheckoutSession,
  parseFeatureAccessResult,
  parseMandate,
  parsePlan,
  parseSubscription,
  planCycleAmountPaise,
  planIncludesFeature,
} from './billing';

const proPlanDto = {
  id: 3,
  code: 'PRO',
  name: 'Professional Plan',
  description: 'For growing teams',
  monthlyPrice: 9999,
  annualPrice: 99990,
  currency: 'INR',
  trialDays: 14,
  maxUsers: 50,
  isActive: true,
  isPublic: true,
  sortOrder: 3,
  version: 1,
  features: [
    {
      id: 11,
      featureCode: 'MODULE_INSPECTIONS',
      featureName: 'Inspections',
      featureType: 'BOOLEAN',
      quotaLimit: null,
      quotaPeriod: null,
      enabled: true,
    },
    {
      id: 12,
      featureCode: 'AI_REPORTS',
      featureName: 'AI reports',
      featureType: 'QUOTA',
      quotaLimit: 100,
      quotaPeriod: 'MONTHLY',
      enabled: true,
    },
  ],
};

describe('parsePlan', () => {
  test('parses the backend PlanDto with its features', () => {
    const plan = parsePlan(proPlanDto);
    expect(plan.code).toBe('PRO');
    expect(plan.monthlyPrice).toBe(9999);
    expect(plan.maxUsers).toBe(50);
    expect(plan.features).toHaveLength(2);
    expect(plan.features[1]).toEqual({
      id: 12,
      featureCode: 'AI_REPORTS',
      featureName: 'AI reports',
      featureType: 'QUOTA',
      quotaLimit: 100,
      quotaPeriod: 'MONTHLY',
      enabled: true,
    });
  });

  test('strips unknown keys and defaults absent optionals', () => {
    const plan = parsePlan({ id: 1, code: 'FREE', somethingNew: 1 });
    expect(plan.name).toBe('FREE');
    expect(plan.features).toEqual([]);
    expect(plan.maxUsers).toBeNull();
    expect(plan.currency).toBe('INR');
    expect('somethingNew' in plan).toBe(false);
  });

  test('rejects a plan without a code', () => {
    expect(() => parsePlan({ id: 1 })).toThrow();
  });
});

describe('plan helpers', () => {
  const plan = parsePlan(proPlanDto);

  test('cycle amount is in paise for the chosen period', () => {
    expect(planCycleAmountPaise(plan, 'MONTHLY')).toBe(999_900);
    expect(planCycleAmountPaise(plan, 'ANNUAL')).toBe(9_999_000);
  });

  test('the annual cycle is above the AFA cap, the monthly one is not', () => {
    expect(exceedsAfaCap(plan, 'MONTHLY')).toBe(false);
    expect(exceedsAfaCap(plan, 'ANNUAL')).toBe(true);
    expect(exceedsAfaCap(plan, 'ANNUAL', DEFAULT_AFA_CAP_PAISE * 10)).toBe(false);
  });

  test('planIncludesFeature reads only enabled features', () => {
    expect(planIncludesFeature(plan, 'MODULE_INSPECTIONS')).toBe(true);
    expect(planIncludesFeature(plan, 'MODULE_BIM')).toBe(false);
    const disabled = parsePlan({
      ...proPlanDto,
      features: [{ ...proPlanDto.features[0], enabled: false }],
    });
    expect(planIncludesFeature(disabled, 'MODULE_INSPECTIONS')).toBe(false);
  });
});

describe('parseSubscription', () => {
  test('parses the merged SubscriptionDto, defaulting the provider fields it does not send yet', () => {
    const sub = parseSubscription({
      id: 7,
      organizationId: 42,
      userId: null,
      plan: proPlanDto,
      status: 'ACTIVE',
      currentPeriodStart: '2026-09-01T00:00:00Z',
      currentPeriodEnd: '2026-10-01T00:00:00Z',
      cancelAtPeriodEnd: false,
      active: true,
      inTrial: false,
      expired: false,
    });
    expect(sub.status).toBe('ACTIVE');
    expect(sub.plan?.code).toBe('PRO');
    expect(sub.provider).toBe('NONE');
    expect(sub.providerSubscriptionId).toBeNull();
    expect(sub.nextChargeAt).toBeNull();
  });

  test('carries the provider fields when present, including PAST_DUE', () => {
    const sub = parseSubscription({
      id: 8,
      status: 'PAST_DUE',
      provider: 'RAZORPAY',
      providerSubscriptionId: 'sub_123',
      nextChargeAt: '2026-09-20T00:00:00Z',
    });
    expect(sub.status).toBe('PAST_DUE');
    expect(sub.provider).toBe('RAZORPAY');
    expect(sub.providerSubscriptionId).toBe('sub_123');
    expect(sub.active).toBe(false);
  });

  test('an unknown status never parses as entitled', () => {
    const sub = parseSubscription({ id: 9, status: 'SOMETHING_NEW' });
    expect(sub.status).toBe('INCOMPLETE');
    expect(sub.active).toBe(false);
  });

  test('isEntitledStatus keeps access during the PAST_DUE grace window only', () => {
    expect(isEntitledStatus('ACTIVE')).toBe(true);
    expect(isEntitledStatus('TRIALING')).toBe(true);
    expect(isEntitledStatus('PAST_DUE')).toBe(true);
    expect(isEntitledStatus('UNPAID')).toBe(false);
    expect(isEntitledStatus('CANCELED')).toBe(false);
    expect(isEntitledStatus('INCOMPLETE')).toBe(false);
  });
});

describe('parseFeatureAccessResult', () => {
  test('a missing allowed is a denial', () => {
    expect(parseFeatureAccessResult({}).allowed).toBe(false);
    expect(parseFeatureAccessResult({ allowed: true, quotaLimit: 10, currentUsage: 3 })).toEqual({
      allowed: true,
      reason: null,
      message: null,
      quotaLimit: 10,
      currentUsage: 3,
    });
  });
});

describe('parseBillingProviderInfo', () => {
  test('provider none is not enabled', () => {
    const info = parseBillingProviderInfo({ provider: 'NONE', enabled: false });
    expect(info.enabled).toBe(false);
    expect(info.keyId).toBeNull();
    expect(info.afaCapPaise).toBe(DEFAULT_AFA_CAP_PAISE);
    expect(BILLING_NOT_CONFIGURED.enabled).toBe(false);
  });

  test('razorpay with a key id is enabled; without one it is not', () => {
    expect(
      parseBillingProviderInfo({ provider: 'RAZORPAY', enabled: true, keyId: 'rzp_test_abc' }).enabled
    ).toBe(true);
    expect(parseBillingProviderInfo({ provider: 'RAZORPAY', enabled: true, keyId: '' }).enabled).toBe(
      false
    );
    expect(parseBillingProviderInfo({ provider: 'RAZORPAY', enabled: false, keyId: 'x' }).enabled).toBe(
      false
    );
  });
});

describe('parseCheckoutSession', () => {
  test('a recurring session carries the subscription id, key id and mandate terms', () => {
    const session = parseCheckoutSession({
      provider: 'RAZORPAY',
      keyId: 'rzp_test_abc',
      providerSubscriptionId: 'sub_123',
      planCode: 'PRO',
      billingPeriod: 'MONTHLY',
      amountPaise: 999_900,
      currency: 'INR',
      recurring: true,
      mandate: { amountCapPaise: 999_900, method: 'UPI_AUTOPAY' },
    });
    expect(session.providerSubscriptionId).toBe('sub_123');
    expect(session.providerOrderId).toBeNull();
    expect(session.recurring).toBe(true);
    expect(session.mandate).toEqual({
      amountCapPaise: 999_900,
      preDebitNoticeHours: 24,
      method: 'UPI_AUTOPAY',
      perChargeApproval: false,
    });
  });

  test('an above-cap cycle flags per-charge approval when the backend does not say', () => {
    const session = parseCheckoutSession({
      keyId: 'rzp_test_abc',
      providerSubscriptionId: 'sub_1',
      amountPaise: 9_999_000,
      mandate: {},
    });
    expect(session.mandate?.perChargeApproval).toBe(true);
  });

  test('rejects a session with neither a subscription id nor an order id', () => {
    expect(() => parseCheckoutSession({ keyId: 'rzp_test_abc' })).toThrow();
  });

  test('rejects a session without a key id', () => {
    expect(() => parseCheckoutSession({ providerOrderId: 'order_1' })).toThrow();
  });
});

describe('parseMandate', () => {
  test('parses the mandate row with normalised method and status', () => {
    const mandate = parseMandate({
      id: 1,
      provider: 'RAZORPAY',
      providerMandateRef: 'token_1',
      method: 'ENACH',
      status: 'AUTHORIZED',
      maxAmountPaise: 1_500_000,
      authorizedAt: '2026-09-10T00:00:00Z',
    });
    expect(mandate.method).toBe('ENACH');
    expect(mandate.status).toBe('AUTHORIZED');
    expect(parseMandate({ id: 2, method: 'WEIRD', status: 'WEIRD' })).toMatchObject({
      method: 'UNKNOWN',
      status: 'CREATED',
    });
  });
});
