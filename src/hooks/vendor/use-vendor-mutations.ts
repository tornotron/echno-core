/**
 * hooks/vendor/use-vendor-mutations.ts
 *
 * React Query mutation hooks for vendors and their sub-resources
 * (contacts, tax identifiers, bank accounts, payment terms).
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
 * Matches every Vendor[] list cache under the 'vendors' namespace —
 * `lists()`, `search(name)`, and `paginated({...})`. Service flattens
 * `PageVendorDto` into `Vendor[]` so all three share the same data shape.
 *
 * Excludes single-vendor caches: `detail`, `summary`, `contacts`,
 * `tax-identifiers`, `bank-accounts`, `payment-terms`. Those are addressed
 * directly by their own key shapes in sub-resource mutations.
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
