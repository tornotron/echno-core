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
 * The catalogue page cache added for the KPI strip is the same hazard a
 * second time: it holds a `PagedMaterials` envelope under the same
 * namespace, and this predicate matches by what a key is *not*, so a new
 * shape is matched by default until it is named here.
 *
 * The first test fails on the old predicate, which returned `true` for the
 * low-stock key; the page tests fail on the predicate as it stood before
 * `page` was excluded.
 */
import { describe, expect, test } from 'bun:test';
import {
  isLowStockCache,
  isMaterialListCache,
  isMaterialPageCache,
} from './cache-predicates';
import { materialsKeys } from './keys';

const q = (queryKey: ReadonlyArray<unknown>) => ({ queryKey });

describe('isMaterialListCache', () => {
  test('does not match the low-stock page cache, which is not an array', () => {
    expect(isMaterialListCache(q(materialsKeys.lowStock({})))).toBe(false);
    expect(
      isMaterialListCache(q(materialsKeys.lowStock({ pageSize: 500 })))
    ).toBe(false);
  });

  test('does not match the catalogue page cache, which is not an array either', () => {
    expect(isMaterialListCache(q(materialsKeys.page({})))).toBe(false);
    expect(isMaterialListCache(q(materialsKeys.page({ pageSize: 1 })))).toBe(
      false
    );
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

describe('isMaterialPageCache', () => {
  test('matches every catalogue page, whatever the paging', () => {
    expect(isMaterialPageCache(q(materialsKeys.page({})))).toBe(true);
    expect(
      isMaterialPageCache(q(materialsKeys.page({ pageNo: 2, pageSize: 50 })))
    ).toBe(true);
  });

  test('matches nothing else under the materials namespace', () => {
    expect(isMaterialPageCache(q(materialsKeys.lists()))).toBe(false);
    expect(isMaterialPageCache(q(materialsKeys.paginated(0, 10)))).toBe(false);
    expect(isMaterialPageCache(q(materialsKeys.lowStock({})))).toBe(false);
    expect(isMaterialPageCache(q(['projects', 'page']))).toBe(false);
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
    expect(isLowStockCache(q(materialsKeys.page({})))).toBe(false);
    expect(isLowStockCache(q(materialsKeys.detail(3)))).toBe(false);
    expect(isLowStockCache(q(['projects', 'low-stock']))).toBe(false);
  });
});
