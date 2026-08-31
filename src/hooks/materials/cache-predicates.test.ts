/**
 * Which material caches a mutation may rewrite in place.
 *
 * `isMaterialListCache` used to mean "anything under `materials` that is
 * not a detail, stock or threshold key", and the updaters it feeds call
 * `.map` and `.filter` on whatever it matches. The low-stock cache holds a
 * page envelope rather than an array, so on the old predicate the first
 * edit to any material threw inside `onSuccess` and left the caches half
 * written. It also must not be patched locally at all: which materials are
 * low is decided on the server, against stock the browser does not hold.
 *
 * The first test fails on the old predicate, which returned `true` for the
 * low-stock key.
 */
import { describe, expect, test } from 'bun:test';
import { isLowStockCache, isMaterialListCache } from './cache-predicates';
import { materialsKeys } from './keys';

const q = (queryKey: ReadonlyArray<unknown>) => ({ queryKey });

describe('isMaterialListCache', () => {
  test('does not match the low-stock page cache, which is not an array', () => {
    expect(isMaterialListCache(q(materialsKeys.lowStock({})))).toBe(false);
    expect(
      isMaterialListCache(q(materialsKeys.lowStock({ pageSize: 500 })))
    ).toBe(false);
  });

  test('matches the three Material[] list caches', () => {
    expect(isMaterialListCache(q(materialsKeys.lists()))).toBe(true);
    expect(isMaterialListCache(q(materialsKeys.search('cement')))).toBe(true);
    expect(isMaterialListCache(q(materialsKeys.paginated(0, 10)))).toBe(true);
  });

  test('still excludes the single-material and threshold caches', () => {
    expect(isMaterialListCache(q(materialsKeys.detail(3)))).toBe(false);
    expect(isMaterialListCache(q(materialsKeys.stock(3)))).toBe(false);
    expect(isMaterialListCache(q(materialsKeys.locationThresholds(3)))).toBe(
      false
    );
  });

  test('ignores another domain’s keys', () => {
    expect(isMaterialListCache(q(['projects', 'list']))).toBe(false);
  });
});

describe('isLowStockCache', () => {
  test('matches every low-stock page, whatever the scope or page size', () => {
    expect(isLowStockCache(q(materialsKeys.lowStock({})))).toBe(true);
    expect(
      isLowStockCache(q(materialsKeys.lowStock({ projectId: 5, pageSize: 1 })))
    ).toBe(true);
  });

  test('matches nothing else under the materials namespace', () => {
    expect(isLowStockCache(q(materialsKeys.lists()))).toBe(false);
    expect(isLowStockCache(q(materialsKeys.detail(3)))).toBe(false);
    expect(isLowStockCache(q(['projects', 'low-stock']))).toBe(false);
  });
});
