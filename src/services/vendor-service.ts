/**
 * services/vendor-service.ts
 *
 * Typed client for vendor backend endpoints.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Vendor,
  VendorContact,
  VendorTaxIdentifier,
  VendorBankAccount,
  VendorPaymentTermsDetails,
  VendorSummary,
  CreateVendorRequest,
  createVendorToJson,
  UpdateVendorRequest,
  updateVendorToJson,
  CreateVendorContactRequest,
  createVendorContactToJson,
  UpdateVendorContactRequest,
  updateVendorContactToJson,
  CreateVendorTaxIdentifierRequest,
  createVendorTaxIdentifierToJson,
  UpdateVendorTaxIdentifierRequest,
  updateVendorTaxIdentifierToJson,
  CreateVendorBankAccountRequest,
  createVendorBankAccountToJson,
  UpdateVendorBankAccountRequest,
  updateVendorBankAccountToJson,
  SetVendorPaymentTermsRequest,
  setVendorPaymentTermsToJson,
  parseVendor,
} from '../types/vendor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function safeParseVendor(data: Raw): Vendor {
  try {
    return parseVendor(data);
  } catch (error) {
    logger.error('Failed to parse vendor:', error);
    throw new ApiError('Failed to process vendor data.', 422);
  }
}

function extractArray(data: Raw): Raw[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  logger.warn('Vendors API returned unexpected format:', {
    type: typeof data,
    keys: data ? Object.keys(data) : null,
  });
  return [];
}

function safeParseVendors(data: Raw): Vendor[] {
  const items = extractArray(data);
  if (items.length === 0) return [];
  try {
    return items.map((item) => parseVendor(item));
  } catch (error) {
    logger.error('Failed to parse vendors:', error);
    throw new ApiError('Failed to process vendors data.', 422);
  }
}

function parseVendorContact(c: Raw): VendorContact {
  return {
    id: c.id,
    contactPerson: c.contactPerson ?? undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    alternatePhone: c.alternatePhone ?? undefined,
    primary: c.primary ?? false,
  };
}

function parseVendorBankAccount(b: Raw): VendorBankAccount {
  return {
    id: b.id,
    bankName: b.bankName ?? undefined,
    accountNumber: b.accountNumber ?? undefined,
    ifscCode: b.ifscCode ?? undefined,
    accountHolderName: b.accountHolderName ?? undefined,
    swift: b.swift ?? undefined,
    default: b.default ?? false,
  };
}

export const vendorService = {
  // ── Core CRUD ─────────────────────────────────────────────────────────────

  async create(dto: CreateVendorRequest): Promise<Vendor> {
    const data = await api.post<Raw>('/vendors/web', createVendorToJson(dto));
    return safeParseVendor(data);
  },

  async getAll(): Promise<Vendor[]> {
    const data = await api.get<Raw[]>('/vendors/web');
    return safeParseVendors(data);
  },

  async getAllPaginated(pageNo = 0, pageSize = 10): Promise<Vendor[]> {
    const data = await api.get<Raw>('/vendors/web/all', { pageNo, pageSize });
    return safeParseVendors(data);
  },

  async search(name: string): Promise<Vendor[]> {
    const data = await api.get<Raw[]>('/vendors/web/search', { name });
    return safeParseVendors(data);
  },

  async getById(id: number): Promise<Vendor> {
    const data = await api.get<Raw>(`/vendors/web/${id}`);
    return safeParseVendor(data);
  },

  async update(id: number, dto: UpdateVendorRequest): Promise<Vendor> {
    const data = await api.patch<Raw>(
      `/vendors/web/${id}`,
      updateVendorToJson(dto)
    );
    return safeParseVendor(data);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/vendors/web/${id}`);
  },

  // ── Summary ───────────────────────────────────────────────────────────────

  async getSummary(vendorId: number): Promise<VendorSummary> {
    const data = await api.get<Raw>(`/vendors/web/${vendorId}/summary`);
    return {
      vendorId: data.vendorId ?? vendorId,
      vendorName: data.vendorName ?? '',
      totalOrders: data.totalOrders ?? undefined,
      pendingOrders: data.pendingOrders ?? undefined,
      completedOrders: data.completedOrders ?? undefined,
      cancelledOrders: data.cancelledOrders ?? undefined,
      totalPurchaseValue: data.totalPurchaseValue ?? undefined,
      totalPaid: data.totalPaid ?? undefined,
      totalOutstanding: data.totalOutstanding ?? undefined,
      lastPaymentDate: data.lastPaymentDate
        ? new Date(data.lastPaymentDate)
        : undefined,
      lastPaymentAmount: data.lastPaymentAmount ?? undefined,
    };
  },

  // ── Contacts ──────────────────────────────────────────────────────────────

  async getContacts(vendorId: number): Promise<VendorContact[]> {
    const data = await api.get<Raw>(`/vendors/web/${vendorId}/contacts`);
    const items = extractArray(data);
    return items.map((c: Raw) => parseVendorContact(c));
  },

  async addContact(
    vendorId: number,
    dto: CreateVendorContactRequest
  ): Promise<VendorContact> {
    const data = await api.post<Raw>(
      `/vendors/web/${vendorId}/contacts`,
      createVendorContactToJson(dto)
    );
    return parseVendorContact(data);
  },

  async updateContact(
    vendorId: number,
    contactId: number,
    dto: UpdateVendorContactRequest
  ): Promise<VendorContact> {
    const data = await api.patch<Raw>(
      `/vendors/web/${vendorId}/contacts/${contactId}`,
      updateVendorContactToJson(dto)
    );
    return parseVendorContact(data);
  },

  async deleteContact(vendorId: number, contactId: number): Promise<void> {
    await api.delete(`/vendors/web/${vendorId}/contacts/${contactId}`);
  },

  // ── Tax Identifiers ───────────────────────────────────────────────────────

  async getTaxIdentifiers(vendorId: number): Promise<VendorTaxIdentifier[]> {
    const data = await api.get<Raw>(`/vendors/web/${vendorId}/tax-identifiers`);
    const items = extractArray(data);
    return items.map((t: Raw) => ({ id: t.id, type: t.type, value: t.value }));
  },

  async addTaxIdentifier(
    vendorId: number,
    dto: CreateVendorTaxIdentifierRequest
  ): Promise<VendorTaxIdentifier> {
    const data = await api.post<Raw>(
      `/vendors/web/${vendorId}/tax-identifiers`,
      createVendorTaxIdentifierToJson(dto)
    );
    return { id: data.id, type: data.type, value: data.value };
  },

  async updateTaxIdentifier(
    vendorId: number,
    taxIdId: number,
    dto: UpdateVendorTaxIdentifierRequest
  ): Promise<VendorTaxIdentifier> {
    const data = await api.patch<Raw>(
      `/vendors/web/${vendorId}/tax-identifiers/${taxIdId}`,
      updateVendorTaxIdentifierToJson(dto)
    );
    return { id: data.id, type: data.type, value: data.value };
  },

  async deleteTaxIdentifier(vendorId: number, taxIdId: number): Promise<void> {
    await api.delete(`/vendors/web/${vendorId}/tax-identifiers/${taxIdId}`);
  },

  // ── Bank Accounts ─────────────────────────────────────────────────────────

  async getBankAccounts(vendorId: number): Promise<VendorBankAccount[]> {
    const data = await api.get<Raw>(`/vendors/web/${vendorId}/bank-accounts`);
    const items = extractArray(data);
    return items.map((b: Raw) => parseVendorBankAccount(b));
  },

  async addBankAccount(
    vendorId: number,
    dto: CreateVendorBankAccountRequest
  ): Promise<VendorBankAccount> {
    const data = await api.post<Raw>(
      `/vendors/web/${vendorId}/bank-accounts`,
      createVendorBankAccountToJson(dto)
    );
    return parseVendorBankAccount(data);
  },

  async updateBankAccount(
    vendorId: number,
    accountId: number,
    dto: UpdateVendorBankAccountRequest
  ): Promise<VendorBankAccount> {
    const data = await api.patch<Raw>(
      `/vendors/web/${vendorId}/bank-accounts/${accountId}`,
      updateVendorBankAccountToJson(dto)
    );
    return parseVendorBankAccount(data);
  },

  async deleteBankAccount(vendorId: number, accountId: number): Promise<void> {
    await api.delete(`/vendors/web/${vendorId}/bank-accounts/${accountId}`);
  },

  // ── Payment Terms ─────────────────────────────────────────────────────────

  async getPaymentTerms(
    vendorId: number
  ): Promise<VendorPaymentTermsDetails | null> {
    try {
      const data = await api.get<Raw>(`/vendors/web/${vendorId}/payment-terms`);
      if (!data) return null;
      return {
        id: data.id,
        paymentTerms: data.paymentTerms,
        creditLimit: data.creditLimit ?? undefined,
        creditDays: data.creditDays ?? undefined,
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async setPaymentTerms(
    vendorId: number,
    dto: SetVendorPaymentTermsRequest
  ): Promise<VendorPaymentTermsDetails> {
    const data = await api.put<Raw>(
      `/vendors/web/${vendorId}/payment-terms`,
      setVendorPaymentTermsToJson(dto)
    );
    return {
      id: data.id,
      paymentTerms: data.paymentTerms,
      creditLimit: data.creditLimit ?? undefined,
      creditDays: data.creditDays ?? undefined,
    };
  },

  async deletePaymentTerms(vendorId: number): Promise<void> {
    await api.delete(`/vendors/web/${vendorId}/payment-terms`);
  },
};
