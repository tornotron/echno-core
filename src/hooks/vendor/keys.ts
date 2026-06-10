/**
 * @module vendor-keys
 *
 * TanStack Query key factory for the vendor domain. Sub-resource caches
 * (contacts, tax identifiers, bank accounts, payment terms, summary) are
 * keyed by parent `vendorId` so the per-vendor lifecycle is uniform —
 * delete-vendor evicts every cache rooted at the same vendor.
 *
 * Key shapes:
 * - `['vendors']` — namespace root, invalidation prefix only; never used
 *   as a query key directly.
 * - `['vendors', 'list']` — the unpaginated vendor list, consumed by
 *   {@link useVendors}.
 * - `['vendors', 'detail', id]` — a single vendor by ID, consumed by
 *   {@link useVendor}.
 * - `['vendors', 'search', name]` — name-scoped search results, consumed
 *   by {@link useVendorSearch}.
 * - `['vendors', 'paginated', { pageNo, pageSize }]` — paginated list,
 *   consumed by {@link useVendorsPaginated}.
 * - `['vendors', 'summary', vendorId]` — financial-rollup summary,
 *   consumed by {@link useVendorSummary}.
 * - `['vendors', 'contacts', vendorId]` — contact list for one vendor.
 * - `['vendors', 'tax-identifiers', vendorId]` — tax identifiers for one
 *   vendor.
 * - `['vendors', 'bank-accounts', vendorId]` — bank accounts for one
 *   vendor.
 * - `['vendors', 'payment-terms', vendorId]` — payment-terms record for
 *   one vendor.
 *
 * The mutation file's `isVendorListCache` predicate matches every
 * `Vendor[]` list cache (`lists`, `search`, `paginated`) but excludes
 * single-vendor caches (`detail`, `summary`, `contacts`, etc.) — see the
 * mutation hooks for the cache-strategy details.
 */
export const vendorKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['vendors'] as const,

  /** Query key for the unpaginated vendor list. */
  lists: () => [...vendorKeys.all, 'list'] as const,

  /** Query key for a single vendor by ID. */
  detail: (id: number) => [...vendorKeys.all, 'detail', id] as const,

  /** Query key for a vendor search by name. */
  search: (name: string) => [...vendorKeys.all, 'search', name] as const,

  /** Query key for a paginated vendor list. */
  paginated: (pageNo: number, pageSize: number) =>
    [...vendorKeys.all, 'paginated', { pageNo, pageSize }] as const,

  /** Query key for the per-vendor financial summary. */
  summary: (vendorId: number) =>
    [...vendorKeys.all, 'summary', vendorId] as const,

  /** Query key for one vendor's contact list. */
  contacts: (vendorId: number) =>
    [...vendorKeys.all, 'contacts', vendorId] as const,

  /** Query key for one vendor's tax identifier list. */
  taxIdentifiers: (vendorId: number) =>
    [...vendorKeys.all, 'tax-identifiers', vendorId] as const,

  /** Query key for one vendor's bank account list. */
  bankAccounts: (vendorId: number) =>
    [...vendorKeys.all, 'bank-accounts', vendorId] as const,

  /** Query key for one vendor's payment-terms record. */
  paymentTerms: (vendorId: number) =>
    [...vendorKeys.all, 'payment-terms', vendorId] as const,
};
