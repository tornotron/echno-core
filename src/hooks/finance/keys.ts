/**
 * @module hooks/finance/finance-keys
 *
 * TanStack Query key factory ({@link financeKeys}) for the finance
 * (general-ledger) domain: accounts, company bank accounts, customers,
 * invoices, payments, and reports.
 *
 * Key shapes (grouped by sub-namespace):
 * - `['finance']` — namespace root (`all`); invalidation prefix only.
 * - `['finance', 'accounts', …]` — list (`accountsList`), tree (`accountTree`),
 *   detail (`account`), by-code (`accountByCode`).
 * - `['finance', 'bank-accounts', …]` — list (`bankAccountsList`),
 *   detail (`bankAccount`).
 * - `['finance', 'customers', …]` — list (`customersList`), detail (`customer`).
 * - `['finance', 'invoices', …]` — detail (`invoice`).
 * - `['finance', 'payments', …]` — detail (`payment`).
 * - `['finance', 'reports', …]` — trial balance, P&L, balance sheet.
 */

import type { CustomerListParams } from '../../services/finance-customer-service';

export const financeKeys = {
  all: ['finance'] as const,

  // Accounts
  accounts: () => [...financeKeys.all, 'accounts'] as const,
  accountsList: (activeOnly?: boolean) =>
    [...financeKeys.accounts(), 'list', { activeOnly }] as const,
  accountTree: () => [...financeKeys.accounts(), 'tree'] as const,
  account: (id: string) => [...financeKeys.accounts(), 'detail', id] as const,
  accountByCode: (code: string) =>
    [...financeKeys.accounts(), 'by-code', code] as const,

  // Company bank accounts
  bankAccounts: () => [...financeKeys.all, 'bank-accounts'] as const,
  bankAccountsList: (activeOnly?: boolean) =>
    [...financeKeys.bankAccounts(), 'list', { activeOnly }] as const,
  bankAccount: (id: string) =>
    [...financeKeys.bankAccounts(), 'detail', id] as const,

  // Customers
  customers: () => [...financeKeys.all, 'customers'] as const,
  customersList: (params?: CustomerListParams) =>
    [...financeKeys.customers(), 'list', params ?? {}] as const,
  customer: (id: string) => [...financeKeys.customers(), 'detail', id] as const,

  // Invoices
  invoices: () => [...financeKeys.all, 'invoices'] as const,
  invoice: (id: string) => [...financeKeys.invoices(), 'detail', id] as const,

  // Payments
  payments: () => [...financeKeys.all, 'payments'] as const,
  payment: (id: string) => [...financeKeys.payments(), 'detail', id] as const,

  // Reports
  reports: () => [...financeKeys.all, 'reports'] as const,
  trialBalance: (asOfDate: string) =>
    [...financeKeys.reports(), 'trial-balance', asOfDate] as const,
  profitAndLoss: (fromDate: string, toDate: string) =>
    [...financeKeys.reports(), 'profit-and-loss', fromDate, toDate] as const,
  balanceSheet: (asOfDate: string) =>
    [...financeKeys.reports(), 'balance-sheet', asOfDate] as const,
};
