/**
 * @module hooks/finance/use-finance-mutations
 *
 * React Query mutation hooks for the finance (general-ledger) domain: accounts,
 * company bank accounts, customers, invoices, and payments.
 *
 * Cache strategy: every finance mutation returns a **full** DTO (except
 * customer-deactivate, which is an ack with no body). Full-DTO responses seed
 * their detail cache via `setQueryData`; list caches are keyed by query params
 * (`activeOnly`, pagination) that can't be spliced deterministically, so they
 * are invalidated by sub-namespace. Mutations that change ledger balances also
 * invalidate the reports namespace.
 *
 * Errors are logged via {@link logger}; success/error toasts are the caller's
 * responsibility (echno-web feature components) — this platform-agnostic module
 * carries no UI feedback.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeKeys } from './keys';
import { logger } from '../../lib/logger';
import { financeAccountService } from '../../services/finance-account-service';
import { financeBankAccountService } from '../../services/finance-bank-account-service';
import { financeCustomerService } from '../../services/finance-customer-service';
import { financeInvoiceService } from '../../services/finance-invoice-service';
import { financePaymentService } from '../../services/finance-payment-service';
import { financeJournalService } from '../../services/finance-journal-service';
import { financeConstructionInvoiceService } from '../../services/finance-construction-invoice-service';
import type {
  CreateAccountRequest,
  CreateCompanyBankAccountRequest,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CreateInvoiceRequest,
  RecordPaymentRequest,
  PostJournalRequest,
  ReverseJournalRequest,
} from '../../types/finance';

// ==================== Accounts ====================

/**
 * Creates a ledger account.
 *
 * Backend response: `AccountDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.account(id), account)` — seeds the detail cache
 *   from the returned DTO, no refetch.
 * - `invalidateQueries(financeKeys.accounts())` — kept: list caches are keyed
 *   by `activeOnly` and the chart-of-accounts tree membership just changed;
 *   neither can be spliced deterministically.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts a
 *   {@link CreateAccountRequest}.
 */
export const useCreateAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAccountRequest) => financeAccountService.create(dto),
    // POST /finance/accounts/web → AccountDto (full)
    onSuccess: (account) => {
      queryClient.setQueryData(financeKeys.account(account.id), account);
      // List caches are keyed by `activeOnly`; invalidate the accounts namespace
      // (covers lists and the tree, whose membership just changed).
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts() });
    },
    onError: (error) => logger.error('Failed to create account:', error),
  });
};

/**
 * Deactivates a ledger account.
 *
 * Backend response: `AccountDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.account(id), account)` — seeds the detail cache
 *   with the updated (deactivated) DTO.
 * - `invalidateQueries(financeKeys.accounts())` — kept: `activeOnly` list
 *   caches and the tree now exclude this account.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts the
 *   account UUID.
 */
export const useDeactivateAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeAccountService.deactivate(id),
    // POST /finance/accounts/web/{id}/deactivate → AccountDto (full)
    onSuccess: (account) => {
      queryClient.setQueryData(financeKeys.account(account.id), account);
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts() });
    },
    onError: (error) => logger.error('Failed to deactivate account:', error),
  });
};

// ==================== Company Bank Accounts ====================

/**
 * Creates a company bank account.
 *
 * Backend response: `CompanyBankAccountDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.bankAccount(id), bankAccount)` — seeds the
 *   detail cache from the returned DTO.
 * - `invalidateQueries(financeKeys.bankAccounts())` — kept: `activeOnly` list
 *   caches cannot be spliced deterministically.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts a
 *   {@link CreateCompanyBankAccountRequest}.
 */
export const useCreateBankAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCompanyBankAccountRequest) =>
      financeBankAccountService.create(dto),
    // POST /finance/company-bank-accounts/web → CompanyBankAccountDto (full)
    onSuccess: (bankAccount) => {
      queryClient.setQueryData(
        financeKeys.bankAccount(bankAccount.id),
        bankAccount
      );
      queryClient.invalidateQueries({ queryKey: financeKeys.bankAccounts() });
    },
    onError: (error) => logger.error('Failed to create bank account:', error),
  });
};

/**
 * Deactivates a company bank account.
 *
 * Backend response: `CompanyBankAccountDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.bankAccount(id), bankAccount)` — seeds the
 *   detail cache with the updated (deactivated) DTO.
 * - `invalidateQueries(financeKeys.bankAccounts())` — kept: `activeOnly` list
 *   caches now exclude this account.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts the
 *   bank-account UUID.
 */
export const useDeactivateBankAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeBankAccountService.deactivate(id),
    // POST /finance/company-bank-accounts/web/{id}/deactivate → CompanyBankAccountDto (full)
    onSuccess: (bankAccount) => {
      queryClient.setQueryData(
        financeKeys.bankAccount(bankAccount.id),
        bankAccount
      );
      queryClient.invalidateQueries({ queryKey: financeKeys.bankAccounts() });
    },
    onError: (error) =>
      logger.error('Failed to deactivate bank account:', error),
  });
};

// ==================== Customers ====================

/**
 * Creates a customer.
 *
 * Backend response: `CustomerDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.customer(id), customer)` — seeds the detail
 *   cache from the returned DTO.
 * - `invalidateQueries(financeKeys.customers())` — kept: list caches are keyed
 *   by name filter and pagination, which cannot be spliced deterministically.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts a
 *   {@link CreateCustomerRequest}.
 */
export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCustomerRequest) =>
      financeCustomerService.create(dto),
    // POST /finance/customers/web → CustomerDto (full)
    onSuccess: (customer) => {
      queryClient.setQueryData(financeKeys.customer(customer.id), customer);
      // List caches are keyed by name/pagination; invalidate the namespace.
      queryClient.invalidateQueries({ queryKey: financeKeys.customers() });
    },
    onError: (error) => logger.error('Failed to create customer:', error),
  });
};

/**
 * Updates a customer.
 *
 * Backend response: `CustomerDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.customer(id), customer)` — replaces the detail
 *   cache with the returned DTO.
 * - `invalidateQueries(financeKeys.customers())` — kept: name/pagination list
 *   caches may now be out of order or filtered differently.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   `{ id: string; dto: UpdateCustomerRequest }`.
 */
export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCustomerRequest }) =>
      financeCustomerService.update(id, dto),
    // PUT /finance/customers/web/{id} → CustomerDto (full)
    onSuccess: (customer) => {
      queryClient.setQueryData(financeKeys.customer(customer.id), customer);
      queryClient.invalidateQueries({ queryKey: financeKeys.customers() });
    },
    onError: (error) => logger.error('Failed to update customer:', error),
  });
};

/**
 * Deactivates a customer.
 *
 * Backend response: `200 OK`, no body (ack).
 *
 * On success (no DTO to seed):
 * - `invalidateQueries(financeKeys.customer(id))` — kept: the ack carries no
 *   updated state, so the detail cache is refetched to pick up the new status.
 * - `invalidateQueries(financeKeys.customers())` — kept: `activeOnly` list
 *   caches now exclude this customer.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts the
 *   customer UUID.
 */
export const useDeactivateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeCustomerService.deactivate(id),
    // POST /finance/customers/web/{id}/deactivate → 200 OK, no body (ack)
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.customer(id) });
      queryClient.invalidateQueries({ queryKey: financeKeys.customers() });
    },
    onError: (error) => logger.error('Failed to deactivate customer:', error),
  });
};

// ==================== Invoices ====================

/**
 * Creates a draft invoice.
 *
 * Backend response: `InvoiceDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.invoice(id), invoice)` — seeds the detail cache
 *   from the returned DTO.
 *
 * No invalidations: a draft posts no journal entry, so ledger reports are
 * unaffected, and the module has no invoice list cache to reconcile.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts a
 *   {@link CreateInvoiceRequest}.
 */
export const useCreateDraftInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateInvoiceRequest) =>
      financeInvoiceService.createDraft(dto),
    // POST /finance/invoices/web → InvoiceDto (full)
    onSuccess: (invoice) => {
      queryClient.setQueryData(financeKeys.invoice(invoice.id), invoice);
    },
    onError: (error) => logger.error('Failed to create draft invoice:', error),
  });
};

/**
 * Issues a draft invoice (posts its journal entry, moving ledger balances).
 *
 * Backend response: `InvoiceDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.invoice(id), invoice)` — seeds the detail cache
 *   with the issued invoice.
 * - `invalidateQueries(financeKeys.reports())` — kept: issuing posts a journal
 *   entry, so trial balance, P&L, and balance sheet are recomputed server-side
 *   and cannot be patched locally.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts the
 *   invoice UUID.
 */
export const useIssueInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeInvoiceService.issue(id),
    // POST /finance/invoices/web/{id}/issue → InvoiceDto (full)
    onSuccess: (invoice) => {
      queryClient.setQueryData(financeKeys.invoice(invoice.id), invoice);
      // Issuing posts a journal entry → ledger reports are now stale.
      queryClient.invalidateQueries({ queryKey: financeKeys.reports() });
    },
    onError: (error) => logger.error('Failed to issue invoice:', error),
  });
};

/**
 * Cancels an invoice.
 *
 * Backend response: `InvoiceDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.invoice(id), invoice)` — seeds the detail cache
 *   with the cancelled invoice.
 * - `invalidateQueries(financeKeys.reports())` — kept: cancellation may post a
 *   reversal journal entry, so ledger reports are recomputed server-side.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   `{ id: string; reason: string }`.
 */
export const useCancelInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      financeInvoiceService.cancel(id, reason),
    // POST /finance/invoices/web/{id}/cancel?reason → InvoiceDto (full)
    onSuccess: (invoice) => {
      queryClient.setQueryData(financeKeys.invoice(invoice.id), invoice);
      // Cancellation may post a reversal journal entry → reports are stale.
      queryClient.invalidateQueries({ queryKey: financeKeys.reports() });
    },
    onError: (error) => logger.error('Failed to cancel invoice:', error),
  });
};

// ==================== Payments ====================

/** Arguments for {@link useRecordPayment}. */
export interface RecordPaymentArgs {
  /** The payment to record. */
  dto: RecordPaymentRequest;
  /** Optional `Idempotency-Key` for safe retries. */
  idempotencyKey?: string;
}

/**
 * Records a customer payment allocated across invoices.
 *
 * Backend response: `PaymentDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.payment(id), payment)` — seeds the detail cache
 *   from the returned DTO.
 * - `invalidateQueries(financeKeys.invoice(invoiceId))` — kept, once per
 *   allocation with a non-null `invoiceId`: each allocated invoice's
 *   status/balance changed and must be refetched.
 * - `invalidateQueries(financeKeys.reports())` — kept: recording a receipt
 *   posts a journal entry, so ledger reports are recomputed server-side.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   {@link RecordPaymentArgs}.
 */
export const useRecordPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dto, idempotencyKey }: RecordPaymentArgs) =>
      financePaymentService.record(dto, idempotencyKey),
    // POST /finance/payments/web → PaymentDto (full)
    onSuccess: (payment) => {
      queryClient.setQueryData(financeKeys.payment(payment.id), payment);
      // Allocated invoices change status/balance; their details are stale.
      for (const allocation of payment.allocations) {
        if (allocation.invoiceId) {
          queryClient.invalidateQueries({
            queryKey: financeKeys.invoice(allocation.invoiceId),
          });
        }
      }
      // Recording a receipt posts a journal entry → reports are stale.
      queryClient.invalidateQueries({ queryKey: financeKeys.reports() });
    },
    onError: (error) => logger.error('Failed to record payment:', error),
  });
};

// ==================== Construction Invoices ====================

/**
 * Submits a draft construction invoice for approval (`DRAFT` to `PENDING`).
 *
 * Backend response: `ConstructionInvoiceDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.constructionInvoice(id), invoice)` seeds the
 *   detail cache with the submitted invoice.
 * - `invalidateQueries(financeKeys.constructionInvoices())` is kept: list caches
 *   are keyed by filters that include status and cannot be spliced.
 *
 * No reports invalidation: submitting posts no journal entry.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts the
 *   invoice UUID.
 */
export const useSubmitConstructionInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeConstructionInvoiceService.submit(id),
    // POST /finance/construction-invoices/web/{id}/submit -> ConstructionInvoiceDto (full)
    onSuccess: (invoice) => {
      queryClient.setQueryData(
        financeKeys.constructionInvoice(invoice.id),
        invoice
      );
      queryClient.invalidateQueries({
        queryKey: financeKeys.constructionInvoices(),
      });
    },
    onError: (error) =>
      logger.error('Failed to submit construction invoice:', error),
  });
};

/**
 * Approves a pending construction invoice (`PENDING` to `APPROVED`), posting its
 * ledger journal entry.
 *
 * Backend response: `ConstructionInvoiceDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.constructionInvoice(id), invoice)` seeds the
 *   detail cache with the approved invoice.
 * - `invalidateQueries(financeKeys.constructionInvoices())` is kept: status-keyed
 *   list caches are now stale.
 * - `invalidateQueries(financeKeys.reports())` is kept: approval posts a journal
 *   entry, so ledger reports are recomputed server-side.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts the
 *   invoice UUID.
 */
export const useApproveConstructionInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeConstructionInvoiceService.approve(id),
    // POST /finance/construction-invoices/web/{id}/approve -> ConstructionInvoiceDto (full)
    onSuccess: (invoice) => {
      queryClient.setQueryData(
        financeKeys.constructionInvoice(invoice.id),
        invoice
      );
      queryClient.invalidateQueries({
        queryKey: financeKeys.constructionInvoices(),
      });
      // Approval posts a journal entry, so ledger reports are now stale.
      queryClient.invalidateQueries({ queryKey: financeKeys.reports() });
    },
    onError: (error) =>
      logger.error('Failed to approve construction invoice:', error),
  });
};

/** Arguments for {@link useCancelConstructionInvoice}. */
export interface CancelConstructionInvoiceArgs {
  /** UUID of the invoice to cancel. */
  id: string;
  /** Cancellation reason (required by the backend). */
  reason: string;
}

/**
 * Cancels a construction invoice (status `CANCELLED`), reversing the posted
 * journal entry.
 *
 * Backend response: `ConstructionInvoiceDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.constructionInvoice(id), invoice)` seeds the
 *   detail cache with the cancelled invoice.
 * - `invalidateQueries(financeKeys.constructionInvoices())` is kept: status-keyed
 *   list caches are now stale.
 * - `invalidateQueries(financeKeys.reports())` is kept: cancellation posts a
 *   reversal journal entry, so ledger reports are recomputed server-side.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   {@link CancelConstructionInvoiceArgs}.
 */
export const useCancelConstructionInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: CancelConstructionInvoiceArgs) =>
      financeConstructionInvoiceService.cancel(id, reason),
    // POST /finance/construction-invoices/web/{id}/cancel?reason -> ConstructionInvoiceDto (full)
    onSuccess: (invoice) => {
      queryClient.setQueryData(
        financeKeys.constructionInvoice(invoice.id),
        invoice
      );
      queryClient.invalidateQueries({
        queryKey: financeKeys.constructionInvoices(),
      });
      // Cancellation posts a reversal journal entry, so reports are stale.
      queryClient.invalidateQueries({ queryKey: financeKeys.reports() });
    },
    onError: (error) =>
      logger.error('Failed to cancel construction invoice:', error),
  });
};

/** Arguments for {@link useRecordConstructionInvoicePayment}. */
export interface RecordConstructionInvoicePaymentArgs {
  /** UUID of the invoice to record a payment against. */
  id: string;
  /** Payment amount to record. */
  amount: number;
}

/**
 * Records a payment against a construction invoice, advancing `paidAmount` and
 * the payment status.
 *
 * Backend response: `ConstructionInvoiceDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.constructionInvoice(id), invoice)` seeds the
 *   detail cache with the updated invoice.
 * - `invalidateQueries(financeKeys.constructionInvoices())` is kept: payment-status
 *   filtered list caches are now stale.
 * - `invalidateQueries(financeKeys.reports())` is kept: recording a payment posts
 *   a journal entry, so ledger reports are recomputed server-side.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   {@link RecordConstructionInvoicePaymentArgs}.
 */
export const useRecordConstructionInvoicePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: RecordConstructionInvoicePaymentArgs) =>
      financeConstructionInvoiceService.recordPayment(id, amount),
    // POST /finance/construction-invoices/web/{id}/record-payment?amount -> ConstructionInvoiceDto (full)
    onSuccess: (invoice) => {
      queryClient.setQueryData(
        financeKeys.constructionInvoice(invoice.id),
        invoice
      );
      queryClient.invalidateQueries({
        queryKey: financeKeys.constructionInvoices(),
      });
      // Recording a payment posts a journal entry, so reports are stale.
      queryClient.invalidateQueries({ queryKey: financeKeys.reports() });
    },
    onError: (error) =>
      logger.error('Failed to record construction invoice payment:', error),
  });
};

// ==================== Journal Entries ====================

/**
 * Posts a manual journal entry.
 *
 * Backend response: `JournalEntryDto` (full).
 *
 * On success:
 * - `setQueryData(financeKeys.journalEntry(id), entry)` — seeds the detail cache.
 * - `invalidateQueries(financeKeys.journalEntries())` — the paged list gained an
 *   entry (list caches are keyed by page params, can't be spliced).
 * - `invalidateQueries(financeKeys.reports())` — posting moves ledger balances.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts a
 *   {@link PostJournalRequest}.
 */
export const usePostJournalEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: PostJournalRequest) => financeJournalService.post(dto),
    // POST /finance/journal-entries/web → JournalEntryDto (full)
    onSuccess: (entry) => {
      queryClient.setQueryData(financeKeys.journalEntry(entry.id), entry);
      queryClient.invalidateQueries({
        queryKey: financeKeys.journalEntries(),
      });
      queryClient.invalidateQueries({ queryKey: financeKeys.reports() });
    },
    onError: (error) => logger.error('Failed to post journal entry:', error),
  });
};

/** Arguments for {@link useReverseJournalEntry}. */
export interface ReverseJournalArgs {
  /** UUID of the entry to reverse. */
  id: string;
  /** Reversal details (optional reason). */
  dto?: ReverseJournalRequest;
}

/**
 * Reverses a posted journal entry (posts a mirror-image entry).
 *
 * Backend response: `JournalEntryDto` (full) — the newly-created **reversal**
 * entry, not the original.
 *
 * On success:
 * - `setQueryData(financeKeys.journalEntry(reversal.id), reversal)` — seeds the
 *   reversal's detail cache.
 * - `invalidateQueries(financeKeys.journalEntry(originalId))` — the original is
 *   now `REVERSED`; refetch it.
 * - `invalidateQueries(financeKeys.journalEntries())` + `reports()` — the list
 *   gained an entry and ledger balances moved.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   {@link ReverseJournalArgs}.
 */
export const useReverseJournalEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: ReverseJournalArgs) =>
      financeJournalService.reverse(id, dto),
    // POST /finance/journal-entries/web/reverse?id → JournalEntryDto (full, the reversal)
    onSuccess: (reversal, { id }) => {
      queryClient.setQueryData(financeKeys.journalEntry(reversal.id), reversal);
      queryClient.invalidateQueries({ queryKey: financeKeys.journalEntry(id) });
      queryClient.invalidateQueries({
        queryKey: financeKeys.journalEntries(),
      });
      queryClient.invalidateQueries({ queryKey: financeKeys.reports() });
    },
    onError: (error) => logger.error('Failed to reverse journal entry:', error),
  });
};
