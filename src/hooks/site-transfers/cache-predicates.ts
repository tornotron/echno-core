/**
 * @module site-transfer-cache-predicates
 *
 * The cache predicate the site-transfer mutations pass to TanStack Query.
 *
 * Internal to the site-transfer hooks: not re-exported from `./index`, so it
 * is not part of the package's public surface. It lives in its own module
 * because what it matches is a correctness property rather than a convenience,
 * and is worth testing on its own.
 */

/**
 * The second key segment of every cache under the `site-transfers` namespace
 * whose data is a `SiteTransfer[]`.
 *
 * An allowlist, deliberately. The obvious alternative is to exclude the key
 * shapes that are not lists, which is a predicate that matches a newly added
 * cache by default: `status-history` holds a page object rather than an array,
 * and every caller of {@link isSiteTransferListCache} maps over what it is
 * handed, so a denylist that had not been updated would hand a page to `.map`
 * and throw inside a cache update. Adding a list cache means adding it here,
 * which is a failure that shows up as a stale list rather than as an exception.
 */
export const SITE_TRANSFER_LIST_SEGMENTS: ReadonlyArray<unknown> = [
  'list',
  'paginated',
  'status',
  'sending-project',
  'receiving-project',
];

/**
 * Matches every `SiteTransfer[]` list cache under the `site-transfers`
 * namespace — `lists()`, `paginated({...})`, `byStatus(s)`,
 * `bySendingProject(id)`, and `byReceivingProject(id)`.
 *
 * Excludes `detail(id)`, which the mutations patch directly by id, and
 * `statusHistory(...)`, which holds a page of trail entries.
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to a site-transfer list cache.
 */
export function isSiteTransferListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'site-transfers' &&
    SITE_TRANSFER_LIST_SEGMENTS.includes(key[1])
  );
}
