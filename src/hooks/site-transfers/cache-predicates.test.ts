/**
 * What the site-transfer list predicate matches, and what it must not.
 *
 * The mutations hand every cache this matches to an updater that calls `.map`
 * on it. The namespace holds two caches that are not arrays of transfers —
 * `detail`, which is one transfer, and `status-history`, which is a page
 * object — so a predicate that matched either would throw inside a cache
 * update after a receipt, on the success path, where the mutation has already
 * happened and the error looks like nothing to do with it.
 *
 * If the allowlist were deleted and the predicate went back to matching
 * everything under the namespace bar `detail`, the `status-history` test below
 * is the one that fails.
 */
import { describe, expect, test } from 'bun:test';

import { isSiteTransferListCache } from './cache-predicates';
import { siteTransferKeys } from './keys';
import { SiteTransferStatus } from '../../types/site-transfers';

/** Wraps a key the way TanStack hands it to a predicate. */
const asQuery = (queryKey: ReadonlyArray<unknown>) => ({ queryKey });

describe('the caches a moved transfer is written into', () => {
  test('every list of transfers is matched', () => {
    const lists = [
      siteTransferKeys.lists(),
      siteTransferKeys.paginated(0, 10),
      siteTransferKeys.byStatus(SiteTransferStatus.pending),
      siteTransferKeys.bySendingProject(2),
      siteTransferKeys.byReceivingProject(6),
    ];

    expect(lists.filter((key) => isSiteTransferListCache(asQuery(key))).length)
      .toBe(lists.length);
  });
});

describe('the caches it must leave alone', () => {
  test('a single transfer is not a list', () => {
    expect(isSiteTransferListCache(asQuery(siteTransferKeys.detail(7)))).toBe(
      false
    );
  });

  test('a status trail is not a list, and mapping over it would throw', () => {
    expect(
      isSiteTransferListCache(asQuery(siteTransferKeys.statusHistory(7, 0, 20)))
    ).toBe(false);
  });

  test('another namespace is not matched at all', () => {
    expect(isSiteTransferListCache(asQuery(['materials', 'list']))).toBe(false);
  });
});
