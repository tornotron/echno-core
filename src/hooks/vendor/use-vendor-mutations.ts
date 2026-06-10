/**
 * @module use-vendor-mutations
 *
 * TanStack mutation hooks for the vendor domain — core CRUD plus the
 * contact / tax identifier / bank account / payment terms sub-resources.
 * Read-side hooks live in {@link useVendor}, {@link useVendors},
 * {@link useVendorsPaginated}, {@link useVendorSearch},
 * {@link useVendorSummary}, and the per-sub-resource list hooks.
 *
 * Every sub-resource mutation invalidates `vendorKeys.detail(vendorId)`
 * because the parent {@link Vendor} interface denormalises fields from
 * each sub-resource onto top-level scalar properties (primary contact →
 * `contactPerson`/`phone`/`alternatePhone`; GST/PAN tax identifiers →
 * `gstNumber`/`panNumber`; default bank account → `bankName`/
 * `accountNumber`/`ifscCode`/`accountHolderName`/`swift`; payment-terms
 * object → `paymentTerms`/`creditLimit`/`creditDays`). The sub-resource
 * response payload doesn't carry the parent's recalculated derived
 * fields, so invalidating and refetching is the only correct path.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorService } from '../../services/vendor-service';
import { vendorKeys } from './vendor-keys';
import { logger } from '../../lib/logger';
import {
  CreateVendorRequest,
  UpdateVendorRequest,
  CreateVendorContactRequest,
  UpdateVendorContactRequest,
  CreateVendorTaxIdentifierRequest,
  UpdateVendorTaxIdentifierRequest,
  CreateVendorBankAccountRequest,
  UpdateVendorBankAccountRequest,
  SetVendorPaymentTermsRequest,
  Vendor,
  VendorContact,
  VendorTaxIdentifier,
  VendorBankAccount,
} from '../../types/vendor';

/**
 * Matches every `Vendor[]` list cache under the `vendors` namespace —
 * `lists()`, `search(name)`, and `paginated({ pageNo, pageSize })`.
 * `vendorService.getAllPaginated` flattens `PageVendorDto` to `Vendor[]`
 * so all three share the same data shape and a single predicate covers
 * them.
 *
 * Excludes single-vendor caches: `detail`, `summary`, `contacts`,
 * `tax-identifiers`, `bank-accounts`, `payment-terms`. Those are
 * addressed directly by their own key shapes inside the sub-resource
 * mutations.
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to a vendor list cache.
 */
function isVendorListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  if (!Array.isArray(key) || key[0] !== 'vendors') return false;
  const segment = key[1];
  return (
    segment !== 'detail' &&
    segment !== 'summary' &&
    segment !== 'contacts' &&
    segment !== 'tax-identifiers' &&
    segment !== 'bank-accounts' &&
    segment !== 'payment-terms'
  );
}

// ── Core CRUD ───────────────────────────────────────────────────────────────

/**
 * Creates a new vendor.
 *
 * Backend response: `VendorDto` (full).
 *
 * On success:
 * - `setQueryData(vendorKeys.detail(newVendor.id), newVendor)` — seeds
 *   the detail cache so an immediate read returns the new vendor without
 *   a network round-trip.
 * - `setQueryData(vendorKeys.lists(), append)` — appends the new vendor
 *   to the unpaginated list.
 * - `invalidateQueries({ predicate: search OR paginated })` — kept:
 *   search results are name-scoped (the new vendor may not match the
 *   active query) and paginated views depend on sort/page boundaries
 *   that can't be recomputed locally.
 *
 * Errors are logged via {@link logger}; the mutation result still
 * surfaces the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateVendorRequest}.
 */
export const useCreateVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateVendorRequest) => vendorService.create(dto),
    onSuccess: (newVendor) => {
      // POST /vendors/web → VendorDto (full).
      // Seed detail + append to main list. Search/paginated caches are
      // invalidated rather than appended: search is name-scoped (may not
      // match) and paginated semantics depend on sort/page.
      queryClient.setQueryData(vendorKeys.detail(newVendor.id), newVendor);
      queryClient.setQueryData<Vendor[]>(vendorKeys.lists(), (old) =>
        old ? [...old, newVendor] : [newVendor]
      );
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'vendors' &&
          (q.queryKey[1] === 'search' || q.queryKey[1] === 'paginated'),
      });
    },
    onError: (error) => {
      logger.error('Failed to create vendor:', error);
    },
  });
};

/**
 * Updates a vendor.
 *
 * Backend response: `VendorDto` (full).
 *
 * On success:
 * - `setQueryData(vendorKeys.detail(id), updatedVendor)` — direct patch
 *   of the detail cache from the full DTO.
 * - `setQueriesData({ predicate: isVendorListCache }, replace)` —
 *   mirrors the update across every `Vendor[]` list cache (`lists`,
 *   `search`, `paginated`).
 * - `invalidateQueries(vendorKeys.summary(id))` — kept: the summary
 *   cache is `VendorSummary` (server-side financial rollups + order
 *   counts), can't be patched from a `Vendor`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; data: UpdateVendorRequest }`.
 */
export const useUpdateVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateVendorRequest }) =>
      vendorService.update(id, data),
    onSuccess: (updatedVendor, { id }) => {
      // PUT /vendors/web/{id} → VendorDto (full).
      // Patch detail + every Vendor[] list cache. Summary may include
      // derived fields (financial rollups, etc.) — invalidate to refetch.
      queryClient.setQueryData(vendorKeys.detail(id), updatedVendor);
      queryClient.setQueriesData<Vendor[]>(
        { predicate: isVendorListCache },
        (old) => old?.map((v) => (v.id === id ? updatedVendor : v))
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.summary(id) });
    },
    onError: (error) => {
      logger.error('Failed to update vendor:', error);
    },
  });
};

/**
 * Deletes a vendor by ID.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * On success:
 * - `removeQueries(vendorKeys.detail(id))` — entity is gone; refetch
 *   would 404.
 * - `removeQueries(vendorKeys.summary(id))` — summary is per-vendor and
 *   no longer addressable.
 * - `removeQueries(vendorKeys.contacts(id))` — sub-resource list keyed
 *   by the now-deleted parent.
 * - `removeQueries(vendorKeys.taxIdentifiers(id))` — same.
 * - `removeQueries(vendorKeys.bankAccounts(id))` — same.
 * - `removeQueries(vendorKeys.paymentTerms(id))` — same.
 * - `setQueriesData({ predicate: isVendorListCache }, filter)` — drops
 *   the deleted vendor from every list cache without a refetch.
 *
 * No invalidations are kept: with the entity gone, every consequence of
 * the delete is local-cache cleanup.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the numeric ID of the vendor to delete.
 */
export const useDeleteVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => vendorService.delete(id),
    onSuccess: (_data, id) => {
      // DELETE /vendors/web/{id} → ApiResponse (ack).
      // Entity gone — evict every cache rooted at this vendor and filter
      // it from list caches.
      queryClient.removeQueries({ queryKey: vendorKeys.detail(id) });
      queryClient.removeQueries({ queryKey: vendorKeys.summary(id) });
      queryClient.removeQueries({ queryKey: vendorKeys.contacts(id) });
      queryClient.removeQueries({ queryKey: vendorKeys.taxIdentifiers(id) });
      queryClient.removeQueries({ queryKey: vendorKeys.bankAccounts(id) });
      queryClient.removeQueries({ queryKey: vendorKeys.paymentTerms(id) });
      queryClient.setQueriesData<Vendor[]>(
        { predicate: isVendorListCache },
        (old) => old?.filter((v) => v.id !== id)
      );
    },
    onError: (error) => {
      logger.error('Failed to delete vendor:', error);
    },
  });
};

// ── Contacts ────────────────────────────────────────────────────────────────

/**
 * Adds a contact to a vendor.
 *
 * Backend response: `VendorContactDto` (full).
 *
 * On success:
 * - `setQueryData(vendorKeys.contacts(vendorId), append)` — appends the
 *   new contact to the per-vendor contact list.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: the parent
 *   vendor's `contactPerson`, `phone`, and `alternatePhone` are
 *   denormalised from `contacts[]` primary, so adding a contact (or
 *   adding one with `primary: true`) may change the parent's derived
 *   fields. Refetch on next observer.
 *
 * @param vendorId - Surrogate ID of the parent vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateVendorContactRequest}.
 */
export const useAddVendorContact = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateVendorContactRequest) =>
      vendorService.addContact(vendorId, dto),
    onSuccess: (newContact) => {
      // POST /vendors/web/{vendorId}/contacts → VendorContactDto (full).
      // Append to the contacts list. Parent vendor.detail carries denormalized
      // contact fields (contactPerson, phone, alternatePhone) derived from
      // contacts[] primary; invalidate so the next observer pulls the fresh
      // derived values.
      queryClient.setQueryData<VendorContact[]>(
        vendorKeys.contacts(vendorId),
        (old) => (old ? [...old, newContact] : [newContact])
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to add vendor contact:', error);
    },
  });
};

/**
 * Updates a vendor contact.
 *
 * Backend response: `VendorContactDto` (full).
 *
 * On success:
 * - `setQueryData(vendorKeys.contacts(vendorId), replace)` — replaces
 *   the updated row in the per-vendor contact list.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: same
 *   denormalisation reason as the add case; promoting a contact to
 *   primary (or changing the primary's fields) shifts the parent's
 *   derived values.
 *
 * @param vendorId - Surrogate ID of the parent vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ contactId: number; contactInput: UpdateVendorContactRequest }`.
 */
export const useUpdateVendorContact = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      contactId,
      contactInput,
    }: {
      contactId: number;
      contactInput: UpdateVendorContactRequest;
    }) => vendorService.updateContact(vendorId, contactId, contactInput),
    onSuccess: (updatedContact, { contactId }) => {
      // PUT /vendors/web/{vendorId}/contacts/{contactId} → VendorContactDto (full).
      // Replace in the contacts list. Vendor.detail's denormalized fields
      // may change if this is the primary contact — invalidate.
      queryClient.setQueryData<VendorContact[]>(
        vendorKeys.contacts(vendorId),
        (old) => old?.map((c) => (c.id === contactId ? updatedContact : c))
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to update vendor contact:', error);
    },
  });
};

/**
 * Deletes a vendor contact.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * On success:
 * - `setQueryData(vendorKeys.contacts(vendorId), filter)` — drops the
 *   deleted row from the per-vendor contact list.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: deleting
 *   the primary contact promotes the next contact's fields onto the
 *   parent's `contactPerson`/`phone`/`alternatePhone`. Refetch on next
 *   observer.
 *
 * @param vendorId - Surrogate ID of the parent vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the numeric ID of the contact to delete.
 */
export const useDeleteVendorContact = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: number) =>
      vendorService.deleteContact(vendorId, contactId),
    onSuccess: (_data, contactId) => {
      // DELETE /vendors/web/{vendorId}/contacts/{contactId} → ApiResponse (ack).
      // Filter from contacts list; invalidate parent for derived fields.
      queryClient.setQueryData<VendorContact[]>(
        vendorKeys.contacts(vendorId),
        (old) => old?.filter((c) => c.id !== contactId)
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to delete vendor contact:', error);
    },
  });
};

// ── Tax Identifiers ──────────────────────────────────────────────────────────

/**
 * Adds a tax identifier to a vendor.
 *
 * Backend response: `VendorTaxIdentifierDto` (full).
 *
 * On success:
 * - `setQueryData(vendorKeys.taxIdentifiers(vendorId), append)` —
 *   appends the new row to the per-vendor tax identifier list.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: the parent
 *   vendor's `gstNumber` and `panNumber` are denormalised from
 *   `taxIdentifiers[]` by type. Adding a GST or PAN row changes the
 *   parent's derived fields.
 *
 * @param vendorId - Surrogate ID of the parent vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateVendorTaxIdentifierRequest}.
 */
export const useAddVendorTaxIdentifier = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateVendorTaxIdentifierRequest) =>
      vendorService.addTaxIdentifier(vendorId, dto),
    onSuccess: (newTaxId) => {
      // POST /vendors/web/{vendorId}/tax-identifiers → VendorTaxIdentifierDto (full).
      // Append to the tax identifiers list. Vendor.detail's gstNumber/panNumber
      // are denormalized from taxIdentifiers[] by type — invalidate to refetch.
      queryClient.setQueryData<VendorTaxIdentifier[]>(
        vendorKeys.taxIdentifiers(vendorId),
        (old) => (old ? [...old, newTaxId] : [newTaxId])
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to add vendor tax identifier:', error);
    },
  });
};

/**
 * Updates a vendor tax identifier.
 *
 * Backend response: `VendorTaxIdentifierDto` (full).
 *
 * On success:
 * - `setQueryData(vendorKeys.taxIdentifiers(vendorId), replace)` —
 *   replaces the updated row in the per-vendor tax identifier list.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: same
 *   denormalisation reason as the add case; updating a GST or PAN value
 *   shifts the parent's `gstNumber`/`panNumber` derived fields.
 *
 * @param vendorId - Surrogate ID of the parent vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ taxIdId: number; taxIdentifierInput: UpdateVendorTaxIdentifierRequest }`.
 */
export const useUpdateVendorTaxIdentifier = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taxIdId,
      taxIdentifierInput,
    }: {
      taxIdId: number;
      taxIdentifierInput: UpdateVendorTaxIdentifierRequest;
    }) =>
      vendorService.updateTaxIdentifier(vendorId, taxIdId, taxIdentifierInput),
    onSuccess: (updatedTaxId, { taxIdId }) => {
      // PUT /vendors/web/{vendorId}/tax-identifiers/{taxIdId} → VendorTaxIdentifierDto (full).
      queryClient.setQueryData<VendorTaxIdentifier[]>(
        vendorKeys.taxIdentifiers(vendorId),
        (old) => old?.map((t) => (t.id === taxIdId ? updatedTaxId : t))
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to update vendor tax identifier:', error);
    },
  });
};

/**
 * Deletes a vendor tax identifier.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * On success:
 * - `setQueryData(vendorKeys.taxIdentifiers(vendorId), filter)` — drops
 *   the deleted row from the per-vendor tax identifier list.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: removing
 *   the GST or PAN row clears the parent's derived `gstNumber`/
 *   `panNumber`.
 *
 * @param vendorId - Surrogate ID of the parent vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the numeric ID of the tax identifier to delete.
 */
export const useDeleteVendorTaxIdentifier = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taxIdId: number) =>
      vendorService.deleteTaxIdentifier(vendorId, taxIdId),
    onSuccess: (_data, taxIdId) => {
      // DELETE /vendors/web/{vendorId}/tax-identifiers/{taxIdId} → ApiResponse (ack).
      queryClient.setQueryData<VendorTaxIdentifier[]>(
        vendorKeys.taxIdentifiers(vendorId),
        (old) => old?.filter((t) => t.id !== taxIdId)
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to delete vendor tax identifier:', error);
    },
  });
};

// ── Bank Accounts ────────────────────────────────────────────────────────────

/**
 * Adds a bank account to a vendor.
 *
 * Backend response: `VendorBankAccountDto` (full).
 *
 * On success:
 * - `setQueryData(vendorKeys.bankAccounts(vendorId), append)` — appends
 *   the new row to the per-vendor bank account list.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: the parent
 *   vendor's `bankName`, `accountNumber`, `ifscCode`, `accountHolderName`,
 *   and `swift` are denormalised from `bankAccounts[]` default. Adding
 *   an account flagged as default shifts the parent's derived fields.
 *
 * @param vendorId - Surrogate ID of the parent vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateVendorBankAccountRequest}.
 */
export const useAddVendorBankAccount = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateVendorBankAccountRequest) =>
      vendorService.addBankAccount(vendorId, dto),
    onSuccess: (newAccount) => {
      // POST /vendors/web/{vendorId}/bank-accounts → VendorBankAccountDto (full).
      // Append to the bank accounts list. Vendor.detail carries denormalized
      // bank fields (bankName, accountNumber, ifscCode, etc.) from the
      // default/first account — invalidate to refetch.
      queryClient.setQueryData<VendorBankAccount[]>(
        vendorKeys.bankAccounts(vendorId),
        (old) => (old ? [...old, newAccount] : [newAccount])
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to add vendor bank account:', error);
    },
  });
};

/**
 * Updates a vendor bank account.
 *
 * Backend response: `VendorBankAccountDto` (full).
 *
 * On success:
 * - `setQueryData(vendorKeys.bankAccounts(vendorId), replace)` —
 *   replaces the updated row in the per-vendor bank account list.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: same
 *   denormalisation reason as the add case; updating the default
 *   account's fields (or promoting an account to default) shifts the
 *   parent's `bankName`/`accountNumber`/`ifscCode`/`accountHolderName`/
 *   `swift` derived fields.
 *
 * @param vendorId - Surrogate ID of the parent vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ accountId: number; bankAccountInput: UpdateVendorBankAccountRequest }`.
 */
export const useUpdateVendorBankAccount = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      bankAccountInput,
    }: {
      accountId: number;
      bankAccountInput: UpdateVendorBankAccountRequest;
    }) =>
      vendorService.updateBankAccount(vendorId, accountId, bankAccountInput),
    onSuccess: (updatedAccount, { accountId }) => {
      // PUT /vendors/web/{vendorId}/bank-accounts/{accountId} → VendorBankAccountDto (full).
      queryClient.setQueryData<VendorBankAccount[]>(
        vendorKeys.bankAccounts(vendorId),
        (old) => old?.map((a) => (a.id === accountId ? updatedAccount : a))
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to update vendor bank account:', error);
    },
  });
};

/**
 * Deletes a vendor bank account.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * On success:
 * - `setQueryData(vendorKeys.bankAccounts(vendorId), filter)` — drops
 *   the deleted row from the per-vendor bank account list.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: removing
 *   the default account promotes the next account onto the parent's
 *   derived bank fields.
 *
 * @param vendorId - Surrogate ID of the parent vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the numeric ID of the bank account to delete.
 */
export const useDeleteVendorBankAccount = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: number) =>
      vendorService.deleteBankAccount(vendorId, accountId),
    onSuccess: (_data, accountId) => {
      // DELETE /vendors/web/{vendorId}/bank-accounts/{accountId} → ApiResponse (ack).
      queryClient.setQueryData<VendorBankAccount[]>(
        vendorKeys.bankAccounts(vendorId),
        (old) => old?.filter((a) => a.id !== accountId)
      );
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to delete vendor bank account:', error);
    },
  });
};

// ── Payment Terms ────────────────────────────────────────────────────────────

/**
 * Upserts the payment-terms record for one vendor.
 *
 * Backend response: `VendorPaymentTermsDto` (full).
 *
 * On success:
 * - `setQueryData(vendorKeys.paymentTerms(vendorId), data)` — direct
 *   overwrite. Payment terms is a single record per vendor (not an
 *   array), so the cache entry is the entire object.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: the parent
 *   vendor's `paymentTerms`, `creditLimit`, and `creditDays` are
 *   denormalised from this object. Refetch on next observer.
 *
 * @param vendorId - Surrogate ID of the vendor.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link SetVendorPaymentTermsRequest}.
 */
export const useSetVendorPaymentTerms = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SetVendorPaymentTermsRequest) =>
      vendorService.setPaymentTerms(vendorId, dto),
    onSuccess: (data) => {
      // PUT /vendors/web/{vendorId}/payment-terms → VendorPaymentTermsDto (full).
      // Payment terms is a single record per vendor — `setQueryData` directly.
      // Vendor.detail carries paymentTerms / creditLimit / creditDays
      // denormalized from this object — invalidate so the next observer
      // sees the fresh derived fields.
      queryClient.setQueryData(vendorKeys.paymentTerms(vendorId), data);
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to set vendor payment terms:', error);
    },
  });
};

/**
 * Removes the payment-terms record for one vendor.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * On success:
 * - `setQueryData(vendorKeys.paymentTerms(vendorId), null)` — clears
 *   the cached object. Mirrors the service's "404 → null" read-side
 *   convention so consumers see the cleared state immediately.
 * - `invalidateQueries(vendorKeys.detail(vendorId))` — kept: clears the
 *   parent's `paymentTerms`/`creditLimit`/`creditDays` derived fields.
 *
 * @param vendorId - Surrogate ID of the vendor.
 * @returns A TanStack `UseMutationResult` whose mutate function takes
 *   no arguments — the `vendorId` is captured in the hook closure.
 */
export const useDeleteVendorPaymentTerms = (vendorId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => vendorService.deletePaymentTerms(vendorId),
    onSuccess: () => {
      // DELETE /vendors/web/{vendorId}/payment-terms → ApiResponse (ack).
      // Payment terms removed — null the cache, invalidate vendor for
      // refreshed denormalized fields.
      queryClient.setQueryData(vendorKeys.paymentTerms(vendorId), null);
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
    onError: (error) => {
      logger.error('Failed to delete vendor payment terms:', error);
    },
  });
};
