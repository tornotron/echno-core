/**
 * @module hooks/finance/use-finance
 *
 * Read-only React Query hooks for the finance (general-ledger) domain:
 * accounts, company bank accounts, customers, invoices, payments, and reports.
 * Mutation hooks live in `use-finance-mutations.ts`. Query keys come from
 * {@link financeKeys}.
 */

import { useQuery } from '@tanstack/react-query';
import { financeKeys } from './keys';
import { financeAccountService } from '../../services/finance-account-service';
import { financeBankAccountService } from '../../services/finance-bank-account-service';
import {
  financeCustomerService,
  type CustomerListParams,
} from '../../services/finance-customer-service';
import { financeInvoiceService } from '../../services/finance-invoice-service';
import { financePaymentService } from '../../services/finance-payment-service';
import { financeReportsService } from '../../services/finance-reports-service';
import {
  standardQueryOptions,
  staticQueryOptions,
} from '../../lib/query/options';

// ==================== Accounts ====================

/**
 * Lists ledger accounts.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min,
 * `refetchOnWindowFocus` in production only).
 *
 * @param activeOnly - When true, restrict to active accounts.
 * @returns A TanStack `UseQueryResult` wrapping `Account[]`.
 */
export const useFinanceAccounts = (activeOnly?: boolean) =>
  useQuery({
    queryKey: financeKeys.accountsList(activeOnly),
    queryFn: () => financeAccountService.list(activeOnly),
    ...standardQueryOptions,
  });

/**
 * Fetches the full chart-of-accounts hierarchy.
 *
 * Uses the **static** query profile (`staleTime` 10 min, `gcTime` 30 min, no
 * focus refetch) — the account tree changes rarely.
 *
 * @returns A TanStack `UseQueryResult` wrapping `AccountTreeNode[]`.
 */
export const useFinanceAccountTree = () =>
  useQuery({
    queryKey: financeKeys.accountTree(),
    queryFn: () => financeAccountService.getTree(),
    ...staticQueryOptions,
  });

/**
 * Fetches a single account by id.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * Disabled until `id` is truthy.
 *
 * @param id - UUID of the account.
 * @returns A TanStack `UseQueryResult` wrapping `Account`.
 */
export const useFinanceAccount = (id: string) =>
  useQuery({
    queryKey: financeKeys.account(id),
    queryFn: () => financeAccountService.getById(id),
    enabled: !!id,
    ...standardQueryOptions,
  });

/**
 * Fetches a single account by code.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * Disabled until `code` is truthy.
 *
 * @param code - Account code.
 * @returns A TanStack `UseQueryResult` wrapping `Account`.
 */
export const useFinanceAccountByCode = (code: string) =>
  useQuery({
    queryKey: financeKeys.accountByCode(code),
    queryFn: () => financeAccountService.getByCode(code),
    enabled: !!code,
    ...standardQueryOptions,
  });

// ==================== Company Bank Accounts ====================

/**
 * Lists company bank accounts.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 *
 * @param activeOnly - When true, restrict to active accounts.
 * @returns A TanStack `UseQueryResult` wrapping `CompanyBankAccount[]`.
 */
export const useFinanceBankAccounts = (activeOnly?: boolean) =>
  useQuery({
    queryKey: financeKeys.bankAccountsList(activeOnly),
    queryFn: () => financeBankAccountService.list(activeOnly),
    ...standardQueryOptions,
  });

/**
 * Fetches a single company bank account by id.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * Disabled until `id` is truthy.
 *
 * @param id - UUID of the bank account.
 * @returns A TanStack `UseQueryResult` wrapping `CompanyBankAccount`.
 */
export const useFinanceBankAccount = (id: string) =>
  useQuery({
    queryKey: financeKeys.bankAccount(id),
    queryFn: () => financeBankAccountService.getById(id),
    enabled: !!id,
    ...standardQueryOptions,
  });

// ==================== Customers ====================

/**
 * Lists / searches customers (paged).
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 *
 * @param params - Optional name filter and pagination.
 * @returns A TanStack `UseQueryResult` wrapping the paged customer result.
 */
export const useFinanceCustomers = (params: CustomerListParams = {}) =>
  useQuery({
    queryKey: financeKeys.customersList(params),
    queryFn: () => financeCustomerService.list(params),
    ...standardQueryOptions,
  });

/**
 * Fetches a single customer by id.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * Disabled until `id` is truthy.
 *
 * @param id - UUID of the customer.
 * @returns A TanStack `UseQueryResult` wrapping `Customer`.
 */
export const useFinanceCustomer = (id: string) =>
  useQuery({
    queryKey: financeKeys.customer(id),
    queryFn: () => financeCustomerService.getById(id),
    enabled: !!id,
    ...standardQueryOptions,
  });

// ==================== Invoices ====================

/**
 * Fetches a single invoice by id.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * Disabled until `id` is truthy.
 *
 * @param id - UUID of the invoice.
 * @returns A TanStack `UseQueryResult` wrapping `Invoice`.
 */
export const useFinanceInvoice = (id: string) =>
  useQuery({
    queryKey: financeKeys.invoice(id),
    queryFn: () => financeInvoiceService.getById(id),
    enabled: !!id,
    ...standardQueryOptions,
  });

// ==================== Payments ====================

/**
 * Fetches a single payment by id.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * Disabled until `id` is truthy.
 *
 * @param id - UUID of the payment.
 * @returns A TanStack `UseQueryResult` wrapping `Payment`.
 */
export const useFinancePayment = (id: string) =>
  useQuery({
    queryKey: financeKeys.payment(id),
    queryFn: () => financePaymentService.getById(id),
    enabled: !!id,
    ...standardQueryOptions,
  });

// ==================== Reports ====================

/**
 * Fetches a trial balance as of a date.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * Disabled until `asOfDate` is truthy.
 *
 * @param asOfDate - As-of date (`YYYY-MM-DD`).
 * @returns A TanStack `UseQueryResult` wrapping the trial-balance report.
 */
export const useTrialBalance = (asOfDate: string) =>
  useQuery({
    queryKey: financeKeys.trialBalance(asOfDate),
    queryFn: () => financeReportsService.trialBalance(asOfDate),
    enabled: !!asOfDate,
    ...standardQueryOptions,
  });

/**
 * Fetches a profit-and-loss report over a date range.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * Disabled until both dates are truthy.
 *
 * @param fromDate - Range start (`YYYY-MM-DD`).
 * @param toDate - Range end (`YYYY-MM-DD`).
 * @returns A TanStack `UseQueryResult` wrapping the profit-and-loss report.
 */
export const useProfitAndLoss = (fromDate: string, toDate: string) =>
  useQuery({
    queryKey: financeKeys.profitAndLoss(fromDate, toDate),
    queryFn: () => financeReportsService.profitAndLoss(fromDate, toDate),
    enabled: !!fromDate && !!toDate,
    ...standardQueryOptions,
  });

/**
 * Fetches a balance sheet as of a date.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * Disabled until `asOfDate` is truthy.
 *
 * @param asOfDate - As-of date (`YYYY-MM-DD`).
 * @returns A TanStack `UseQueryResult` wrapping the balance-sheet report.
 */
export const useBalanceSheet = (asOfDate: string) =>
  useQuery({
    queryKey: financeKeys.balanceSheet(asOfDate),
    queryFn: () => financeReportsService.balanceSheet(asOfDate),
    enabled: !!asOfDate,
    ...standardQueryOptions,
  });
