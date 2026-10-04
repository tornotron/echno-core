import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { contractBillingKeys } from './keys';

const source = readFileSync(new URL('./use-contract-billing-mutations.ts', import.meta.url), 'utf8');

describe('contract billing keys', () => {
  test('keys share their domain prefix', () => {
    expect(contractBillingKeys.contract(3)).toEqual(['contract-billing', 'contract', 3]);
    expect(contractBillingKeys.events('b1')).toEqual(['contract-billing', 'bill', 'b1', 'events']);
    expect(contractBillingKeys.bills({ projectId: 7 })).toEqual(['contract-billing', 'bills', { projectId: 7 }]);
  });

  test('every billing mutation invalidates the billing prefix', () => {
    const hooks = [...source.matchAll(/export function (use\w+)\(/g)].map((m) => m[1]);
    expect(hooks.length).toBeGreaterThan(15);
    for (const hook of hooks) {
      const start = source.indexOf(`export function ${hook}(`);
      expect(source.slice(start, source.indexOf('\n}\n', start)), hook).toInclude('onSuccess: invalidate');
    }
  });
});
