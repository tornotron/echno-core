/**
 * @module use-vendor
 *
 * TanStack Query hooks for reading vendors and their sub-resources.
 * Mutations live in {@link useCreateVendor}, {@link useUpdateVendor},
 * {@link useDeleteVendor}, and the sub-resource mutation hooks alongside
 * them.
 *
 * None of the query hooks below spread a profile from `lib/query/options`;
 * they inherit the host `QueryClient`'s defaults (mirroring the
 * **standard** profile of `staleTime` 60 s / `gcTime` 5 min when the host
 * uses the recommended setup).
 */
import { useQuery } from '@tanstack/react-query';
import { vendorService } from '../../services/vendor-service';
import { vendorKeys } from './keys';

/**
 * Fetches every vendor (unpaginated).
 *
 * @returns A TanStack `UseQueryResult` wrapping `Vendor[]`.
 */
export const useVendors = () =>
  useQuery({
    queryKey: vendorKeys.lists(),
    queryFn: () => vendorService.getAll(),
  });

/**
 * Fetches a page of vendors.
 *
 * @param pageNo - Zero-based page number. Defaults to `0`.
 * @param pageSize - Number of vendors per page. Defaults to `10`.
 * @returns A TanStack `UseQueryResult` wrapping `Vendor[]` for the page.
 */
export const useVendorsPaginated = (pageNo = 0, pageSize = 10) =>
  useQuery({
    queryKey: vendorKeys.paginated(pageNo, pageSize),
    queryFn: () => vendorService.getAllPaginated(pageNo, pageSize),
  });

/**
 * Fetches a single vendor by ID. The query is disabled until `id` is
 * truthy.
 *
 * @param id - Surrogate ID of the vendor. Pass `0` (or any falsy value)
 *   to defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single `Vendor`.
 */
export const useVendor = (id: number) =>
  useQuery({
    queryKey: vendorKeys.detail(id),
    queryFn: () => vendorService.getById(id),
    enabled: !!id,
  });

/**
 * Searches vendors by name. The query is disabled until `name` is a
 * non-empty string.
 *
 * @param name - Substring to match against vendor names.
 * @returns A TanStack `UseQueryResult` wrapping the matching `Vendor[]`.
 */
export const useVendorSearch = (name: string) =>
  useQuery({
    queryKey: vendorKeys.search(name),
    queryFn: () => vendorService.search(name),
    enabled: name.length > 0,
  });

/**
 * Fetches the financial-rollup summary for one vendor. The query is
 * disabled until `vendorId` is truthy.
 *
 * @param vendorId - Surrogate ID of the vendor.
 * @returns A TanStack `UseQueryResult` wrapping a single `VendorSummary`.
 */
export const useVendorSummary = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.summary(vendorId),
    queryFn: () => vendorService.getSummary(vendorId),
    enabled: !!vendorId,
  });

/**
 * Fetches every contact for one vendor. The query is disabled until
 * `vendorId` is truthy.
 *
 * @param vendorId - Surrogate ID of the vendor.
 * @returns A TanStack `UseQueryResult` wrapping `VendorContact[]`.
 */
export const useVendorContacts = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.contacts(vendorId),
    queryFn: () => vendorService.getContacts(vendorId),
    enabled: !!vendorId,
  });

/**
 * Fetches every tax identifier for one vendor. The query is disabled
 * until `vendorId` is truthy.
 *
 * @param vendorId - Surrogate ID of the vendor.
 * @returns A TanStack `UseQueryResult` wrapping `VendorTaxIdentifier[]`.
 */
export const useVendorTaxIdentifiers = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.taxIdentifiers(vendorId),
    queryFn: () => vendorService.getTaxIdentifiers(vendorId),
    enabled: !!vendorId,
  });

/**
 * Fetches every bank account for one vendor. The query is disabled
 * until `vendorId` is truthy.
 *
 * @param vendorId - Surrogate ID of the vendor.
 * @returns A TanStack `UseQueryResult` wrapping `VendorBankAccount[]`.
 */
export const useVendorBankAccounts = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.bankAccounts(vendorId),
    queryFn: () => vendorService.getBankAccounts(vendorId),
    enabled: !!vendorId,
  });

/**
 * Fetches the payment-terms record for one vendor. The service treats a
 * 404 as "no terms set yet" and resolves the query data as `null` rather
 * than triggering an error. The query is disabled until `vendorId` is
 * truthy.
 *
 * @param vendorId - Surrogate ID of the vendor.
 * @returns A TanStack `UseQueryResult` wrapping a single
 *   `VendorPaymentTermsDetails` or `null`.
 */
export const useVendorPaymentTerms = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.paymentTerms(vendorId),
    queryFn: () => vendorService.getPaymentTerms(vendorId),
    enabled: !!vendorId,
  });
