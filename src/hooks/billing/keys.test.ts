import { describe, expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { billingKeys } from './keys';
import { invalidateEntitlements } from './use-billing-mutations';
import { moduleKeys } from '../module/keys';

describe('billingKeys', () => {
  test('every key sits under the billing root so one prefix invalidates all', () => {
    for (const key of [
      billingKeys.plans(),
      billingKeys.plan('PRO'),
      billingKeys.subscription(),
      billingKeys.history(),
      billingKeys.featureAccess('MODULE_INSPECTIONS'),
      billingKeys.provider(),
      billingKeys.mandate(),
      billingKeys.events(),
    ]) {
      expect(key[0]).toBe('billing');
    }
    expect(billingKeys.featureAccess('A')).not.toEqual(billingKeys.featureAccess('B'));
  });
});

describe('invalidateEntitlements', () => {
  test('invalidates the billing namespace and the enabled-module set', async () => {
    const client = new QueryClient();
    client.setQueryData(billingKeys.subscription(), { id: 1 });
    client.setQueryData(billingKeys.featureAccess('MODULE_INSPECTIONS'), { allowed: false });
    client.setQueryData(moduleKeys.enabled(), []);
    client.setQueryData(['unrelated'], 1);
    await invalidateEntitlements(client);
    expect(client.getQueryState(billingKeys.subscription())?.isInvalidated).toBe(true);
    expect(client.getQueryState(billingKeys.featureAccess('MODULE_INSPECTIONS'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(moduleKeys.enabled())?.isInvalidated).toBe(true);
    expect(client.getQueryState(['unrelated'])?.isInvalidated).toBe(false);
  });
});
