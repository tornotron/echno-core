/**
 * hooks/vendor/use-vendor.ts
 *
 * React Query hooks for fetching vendors.
 */

import { useQuery } from '@tanstack/react-query';
import { vendorService } from '../../services/vendor-service';
import { vendorKeys } from './vendor-keys';

export const useVendors = () =>
  useQuery({
    queryKey: vendorKeys.lists(),
    queryFn: () => vendorService.getAll(),
  });

export const useVendorsPaginated = (pageNo = 0, pageSize = 10) =>
  useQuery({
    queryKey: vendorKeys.paginated(pageNo, pageSize),
    queryFn: () => vendorService.getAllPaginated(pageNo, pageSize),
  });

export const useVendor = (id: number) =>
  useQuery({
    queryKey: vendorKeys.detail(id),
    queryFn: () => vendorService.getById(id),
    enabled: !!id,
  });

export const useVendorSearch = (name: string) =>
  useQuery({
    queryKey: vendorKeys.search(name),
    queryFn: () => vendorService.search(name),
    enabled: name.length > 0,
  });

export const useVendorSummary = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.summary(vendorId),
    queryFn: () => vendorService.getSummary(vendorId),
    enabled: !!vendorId,
  });

export const useVendorContacts = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.contacts(vendorId),
    queryFn: () => vendorService.getContacts(vendorId),
    enabled: !!vendorId,
  });

export const useVendorTaxIdentifiers = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.taxIdentifiers(vendorId),
    queryFn: () => vendorService.getTaxIdentifiers(vendorId),
    enabled: !!vendorId,
  });

export const useVendorBankAccounts = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.bankAccounts(vendorId),
    queryFn: () => vendorService.getBankAccounts(vendorId),
    enabled: !!vendorId,
  });

export const useVendorPaymentTerms = (vendorId: number) =>
  useQuery({
    queryKey: vendorKeys.paymentTerms(vendorId),
    queryFn: () => vendorService.getPaymentTerms(vendorId),
    enabled: !!vendorId,
  });
