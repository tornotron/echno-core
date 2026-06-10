/**
 * @module vendor-service
 *
 * Typed client for the vendor backend endpoints under `/vendors/web`.
 * Wraps `api.*` calls and parses raw JSON into strongly-typed
 * {@link Vendor} domain objects plus their sub-resources
 * ({@link VendorContact}, {@link VendorTaxIdentifier},
 * {@link VendorBankAccount}, {@link VendorPaymentTermsDetails}).
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
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

/**
 * Backend response shape audit:
 *
 *   POST   /vendors/web                               → VendorDto                   (full)
 *   GET    /vendors/web                               → VendorDto[]                 (full list)
 *   GET    /vendors/web/all?pageNo&pageSize           → PageVendorDto               (paginated; flattened to VendorDto[])
 *   GET    /vendors/web/search?name                   → VendorDto[]                 (full)
 *   GET    /vendors/web/{id}                          → VendorDto                   (full)
 *   PATCH  /vendors/web/{id}                          → VendorDto                   (full)
 *   DELETE /vendors/web/{id}                          → ApiResponse                 (ack only)
 *   GET    /vendors/web/{id}/summary                  → VendorSummaryDto            (financial rollups)
 *   GET    /vendors/web/{id}/contacts                 → VendorContactDto[]          (full)
 *   POST   /vendors/web/{id}/contacts                 → VendorContactDto            (full)
 *   PATCH  /vendors/web/{id}/contacts/{cid}           → VendorContactDto            (full)
 *   DELETE /vendors/web/{id}/contacts/{cid}           → ApiResponse                 (ack only)
 *   GET    /vendors/web/{id}/tax-identifiers          → VendorTaxIdentifierDto[]    (full)
 *   POST   /vendors/web/{id}/tax-identifiers          → VendorTaxIdentifierDto      (full)
 *   PATCH  /vendors/web/{id}/tax-identifiers/{tid}    → VendorTaxIdentifierDto      (full)
 *   DELETE /vendors/web/{id}/tax-identifiers/{tid}    → ApiResponse                 (ack only)
 *   GET    /vendors/web/{id}/bank-accounts            → VendorBankAccountDto[]      (full)
 *   POST   /vendors/web/{id}/bank-accounts            → VendorBankAccountDto        (full)
 *   PATCH  /vendors/web/{id}/bank-accounts/{aid}      → VendorBankAccountDto        (full)
 *   DELETE /vendors/web/{id}/bank-accounts/{aid}      → ApiResponse                 (ack only)
 *   GET    /vendors/web/{id}/payment-terms            → VendorPaymentTermsDto       (full; 404 → null)
 *   PUT    /vendors/web/{id}/payment-terms            → VendorPaymentTermsDto       (full upsert)
 *   DELETE /vendors/web/{id}/payment-terms            → ApiResponse                 (ack only)
 *
 * The parent {@link Vendor} carries denormalised fields drawn from the
 * sub-resources (contacts primary → `contactPerson` / `phone` /
 * `alternatePhone`; tax identifiers by type → `gstNumber` / `panNumber`;
 * bank accounts default → `bankName` / `accountNumber` / `ifscCode` /
 * `accountHolderName` / `swift`; payment-terms object →
 * `paymentTerms` / `creditLimit` / `creditDays`). Sub-resource mutations
 * therefore invalidate the parent's detail cache rather than try to
 * patch derived fields locally — see the mutation hooks for the
 * cache-strategy details.
 */

/**
 * Parses a single vendor payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link Vendor}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseVendor(data: Raw): Vendor {
  try {
    return parseVendor(data);
  } catch (error) {
    logger.error('Failed to parse vendor:', error);
    throw new ApiError('Failed to process vendor data.', 422);
  }
}

/**
 * Coerces a vendor-list payload into a plain array. Accepts either a raw
 * array (returned by the unpaginated `GET /vendors/web`) or a paged
 * envelope `{ content: VendorDto[], ... }` (returned by
 * `GET /vendors/web/all`). Logs a warning and returns `[]` for any other
 * shape so a partial outage doesn't break consumers.
 *
 * @param data - The raw JSON value from the backend.
 * @returns The extracted array, or `[]` when the payload shape is
 *   unrecognised.
 */
function extractArray(data: Raw): Raw[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  logger.warn('Vendors API returned unexpected format:', {
    type: typeof data,
    keys: data ? Object.keys(data) : null,
  });
  return [];
}

/**
 * Parses an array of vendor payloads. Accepts the same shapes
 * {@link extractArray} accepts and silently yields `[]` for an empty
 * input.
 *
 * @param data - The raw JSON array or paged envelope from the backend.
 * @returns An array of parsed {@link Vendor} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
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

/**
 * Parses a single contact payload. Inline because contacts have no
 * canonical-shape divergence to reconcile.
 *
 * @param c - The raw JSON object from the backend.
 * @returns The parsed {@link VendorContact}.
 */
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

/**
 * Parses a single bank-account payload. Inline for the same reason as
 * {@link parseVendorContact}.
 *
 * @param b - The raw JSON object from the backend.
 * @returns The parsed {@link VendorBankAccount}.
 */
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

/**
 * Thin wrapper around the backend vendor REST endpoints. Methods are
 * grouped by sub-resource family: core CRUD, summary, contacts, tax
 * identifiers, bank accounts, payment terms.
 */
export const vendorService = {
  // ── Core CRUD ─────────────────────────────────────────────────────────────

  /**
   * Creates a new vendor.
   *
   * `POST /vendors/web` → `VendorDto` (full).
   *
   * @param dto - The create request payload.
   * @returns The newly created {@link Vendor}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async create(dto: CreateVendorRequest): Promise<Vendor> {
    const data = await api.post<Raw>('/vendors/web', createVendorToJson(dto));
    return safeParseVendor(data);
  },

  /**
   * Fetches every vendor (unpaginated).
   *
   * `GET /vendors/web` → `VendorDto[]` (full).
   *
   * @returns A resolved array of {@link Vendor} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAll(): Promise<Vendor[]> {
    const data = await api.get<Raw[]>('/vendors/web');
    return safeParseVendors(data);
  },

  /**
   * Fetches a page of vendors.
   *
   * `GET /vendors/web/all?pageNo&pageSize` → `PageVendorDto` (flattened
   * to `VendorDto[]` by {@link extractArray}).
   *
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of vendors per page. Defaults to `10`.
   * @returns A resolved array of {@link Vendor} objects for the requested
   *   page.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAllPaginated(pageNo = 0, pageSize = 10): Promise<Vendor[]> {
    const data = await api.get<Raw>('/vendors/web/all', { pageNo, pageSize });
    return safeParseVendors(data);
  },

  /**
   * Searches vendors by name.
   *
   * `GET /vendors/web/search?name` → `VendorDto[]` (full).
   *
   * @param name - Substring to match against vendor names.
   * @returns A resolved array of matching {@link Vendor} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async search(name: string): Promise<Vendor[]> {
    const data = await api.get<Raw[]>('/vendors/web/search', { name });
    return safeParseVendors(data);
  },

  /**
   * Fetches a single vendor by ID.
   *
   * `GET /vendors/web/{id}` → `VendorDto` (full).
   *
   * @param id - Surrogate ID of the vendor.
   * @returns The resolved {@link Vendor}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getById(id: number): Promise<Vendor> {
    const data = await api.get<Raw>(`/vendors/web/${id}`);
    return safeParseVendor(data);
  },

  /**
   * Updates a vendor.
   *
   * `PATCH /vendors/web/{id}` → `VendorDto` (full).
   *
   * @param id - Surrogate ID of the vendor.
   * @param dto - Fields to update; only set fields are sent.
   * @returns The updated {@link Vendor}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async update(id: number, dto: UpdateVendorRequest): Promise<Vendor> {
    const data = await api.patch<Raw>(
      `/vendors/web/${id}`,
      updateVendorToJson(dto)
    );
    return safeParseVendor(data);
  },

  /**
   * Deletes a vendor by ID.
   *
   * `DELETE /vendors/web/{id}` → `ApiResponse` (ack only).
   *
   * @param id - Surrogate ID of the vendor to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/vendors/web/${id}`);
  },

  // ── Summary ───────────────────────────────────────────────────────────────

  /**
   * Fetches the financial-rollup summary for one vendor.
   *
   * `GET /vendors/web/{vendorId}/summary` → `VendorSummaryDto` (full).
   * Missing scalar fields on the response are coerced to `undefined`;
   * `vendorName` is coerced to an empty string when absent.
   *
   * @param vendorId - Surrogate ID of the vendor.
   * @returns The resolved {@link VendorSummary}.
   * @throws {ApiError} On non-2xx response.
   */
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

  /**
   * Fetches every contact for one vendor.
   *
   * `GET /vendors/web/{vendorId}/contacts` → `VendorContactDto[]` (full).
   *
   * @param vendorId - Surrogate ID of the vendor.
   * @returns A resolved array of {@link VendorContact} objects.
   * @throws {ApiError} On non-2xx response.
   */
  async getContacts(vendorId: number): Promise<VendorContact[]> {
    const data = await api.get<Raw>(`/vendors/web/${vendorId}/contacts`);
    const items = extractArray(data);
    return items.map((c: Raw) => parseVendorContact(c));
  },

  /**
   * Adds a contact to a vendor.
   *
   * `POST /vendors/web/{vendorId}/contacts` → `VendorContactDto` (full).
   *
   * @param vendorId - Surrogate ID of the parent vendor.
   * @param dto - The contact to add.
   * @returns The newly created {@link VendorContact}.
   * @throws {ApiError} On non-2xx response.
   */
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

  /**
   * Updates a vendor contact.
   *
   * `PATCH /vendors/web/{vendorId}/contacts/{contactId}` →
   * `VendorContactDto` (full).
   *
   * @param vendorId - Surrogate ID of the parent vendor.
   * @param contactId - Surrogate ID of the contact to update.
   * @param dto - Fields to update; only set fields are sent.
   * @returns The updated {@link VendorContact}.
   * @throws {ApiError} On non-2xx response.
   */
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

  /**
   * Deletes a vendor contact.
   *
   * `DELETE /vendors/web/{vendorId}/contacts/{contactId}` →
   * `ApiResponse` (ack only).
   *
   * @param vendorId - Surrogate ID of the parent vendor.
   * @param contactId - Surrogate ID of the contact to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async deleteContact(vendorId: number, contactId: number): Promise<void> {
    await api.delete(`/vendors/web/${vendorId}/contacts/${contactId}`);
  },

  // ── Tax Identifiers ───────────────────────────────────────────────────────

  /**
   * Fetches every tax identifier for one vendor.
   *
   * `GET /vendors/web/{vendorId}/tax-identifiers` →
   * `VendorTaxIdentifierDto[]` (full).
   *
   * @param vendorId - Surrogate ID of the vendor.
   * @returns A resolved array of {@link VendorTaxIdentifier} objects.
   * @throws {ApiError} On non-2xx response.
   */
  async getTaxIdentifiers(vendorId: number): Promise<VendorTaxIdentifier[]> {
    const data = await api.get<Raw>(`/vendors/web/${vendorId}/tax-identifiers`);
    const items = extractArray(data);
    return items.map((t: Raw) => ({ id: t.id, type: t.type, value: t.value }));
  },

  /**
   * Adds a tax identifier to a vendor.
   *
   * `POST /vendors/web/{vendorId}/tax-identifiers` →
   * `VendorTaxIdentifierDto` (full).
   *
   * @param vendorId - Surrogate ID of the parent vendor.
   * @param dto - The tax identifier to add.
   * @returns The newly created {@link VendorTaxIdentifier}.
   * @throws {ApiError} On non-2xx response.
   */
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

  /**
   * Updates a vendor tax identifier.
   *
   * `PATCH /vendors/web/{vendorId}/tax-identifiers/{taxIdId}` →
   * `VendorTaxIdentifierDto` (full).
   *
   * @param vendorId - Surrogate ID of the parent vendor.
   * @param taxIdId - Surrogate ID of the tax identifier to update.
   * @param dto - Fields to update; only set fields are sent.
   * @returns The updated {@link VendorTaxIdentifier}.
   * @throws {ApiError} On non-2xx response.
   */
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

  /**
   * Deletes a vendor tax identifier.
   *
   * `DELETE /vendors/web/{vendorId}/tax-identifiers/{taxIdId}` →
   * `ApiResponse` (ack only).
   *
   * @param vendorId - Surrogate ID of the parent vendor.
   * @param taxIdId - Surrogate ID of the tax identifier to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async deleteTaxIdentifier(vendorId: number, taxIdId: number): Promise<void> {
    await api.delete(`/vendors/web/${vendorId}/tax-identifiers/${taxIdId}`);
  },

  // ── Bank Accounts ─────────────────────────────────────────────────────────

  /**
   * Fetches every bank account for one vendor.
   *
   * `GET /vendors/web/{vendorId}/bank-accounts` →
   * `VendorBankAccountDto[]` (full).
   *
   * @param vendorId - Surrogate ID of the vendor.
   * @returns A resolved array of {@link VendorBankAccount} objects.
   * @throws {ApiError} On non-2xx response.
   */
  async getBankAccounts(vendorId: number): Promise<VendorBankAccount[]> {
    const data = await api.get<Raw>(`/vendors/web/${vendorId}/bank-accounts`);
    const items = extractArray(data);
    return items.map((b: Raw) => parseVendorBankAccount(b));
  },

  /**
   * Adds a bank account to a vendor.
   *
   * `POST /vendors/web/{vendorId}/bank-accounts` →
   * `VendorBankAccountDto` (full).
   *
   * @param vendorId - Surrogate ID of the parent vendor.
   * @param dto - The bank account to add.
   * @returns The newly created {@link VendorBankAccount}.
   * @throws {ApiError} On non-2xx response.
   */
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

  /**
   * Updates a vendor bank account.
   *
   * `PATCH /vendors/web/{vendorId}/bank-accounts/{accountId}` →
   * `VendorBankAccountDto` (full).
   *
   * @param vendorId - Surrogate ID of the parent vendor.
   * @param accountId - Surrogate ID of the bank account to update.
   * @param dto - Fields to update; only set fields are sent.
   * @returns The updated {@link VendorBankAccount}.
   * @throws {ApiError} On non-2xx response.
   */
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

  /**
   * Deletes a vendor bank account.
   *
   * `DELETE /vendors/web/{vendorId}/bank-accounts/{accountId}` →
   * `ApiResponse` (ack only).
   *
   * @param vendorId - Surrogate ID of the parent vendor.
   * @param accountId - Surrogate ID of the bank account to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async deleteBankAccount(vendorId: number, accountId: number): Promise<void> {
    await api.delete(`/vendors/web/${vendorId}/bank-accounts/${accountId}`);
  },

  // ── Payment Terms ─────────────────────────────────────────────────────────

  /**
   * Fetches the payment-terms record for one vendor.
   *
   * `GET /vendors/web/{vendorId}/payment-terms` →
   * `VendorPaymentTermsDto` (full). A 404 response is treated as "no
   * terms set yet" and resolved as `null` rather than thrown.
   *
   * @param vendorId - Surrogate ID of the vendor.
   * @returns The resolved {@link VendorPaymentTermsDetails}, or `null`
   *   when the vendor has no payment-terms record.
   * @throws {ApiError} On non-2xx, non-404 responses.
   */
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

  /**
   * Upserts the payment-terms record for one vendor.
   *
   * `PUT /vendors/web/{vendorId}/payment-terms` →
   * `VendorPaymentTermsDto` (full). PUT semantics — the call idempotently
   * overwrites whatever was previously stored.
   *
   * @param vendorId - Surrogate ID of the vendor.
   * @param dto - The payment-terms payload.
   * @returns The persisted {@link VendorPaymentTermsDetails}.
   * @throws {ApiError} On non-2xx response.
   */
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

  /**
   * Removes the payment-terms record for one vendor.
   *
   * `DELETE /vendors/web/{vendorId}/payment-terms` → `ApiResponse` (ack
   * only).
   *
   * @param vendorId - Surrogate ID of the vendor.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async deletePaymentTerms(vendorId: number): Promise<void> {
    await api.delete(`/vendors/web/${vendorId}/payment-terms`);
  },
};
