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
 * - `['finance', 'invoices', …]` — list (`invoicesList`), detail (`invoice`).
 * - `['finance', 'payments', …]` — detail (`payment`).
 * - `['finance', 'expenses', …]` — list (`expensesList`), page (`expensesPage`),
 *   detail (`expense`).
 * - `['finance', 'receipts', …]` — list (`receiptsList`), page (`receiptsPage`),
 *   detail (`receipt`).
 * - `['finance', 'posting-accounts', …]` — mappings list (`postingAccountsList`).
 * - `['finance', 'cost-categories', …]` — list (`costCategoriesList`),
 *   detail (`costCategory`).
 * - `['finance', 'project-budgets', …]` — a project's allocations (`projectBudget`).
 * - `['finance', 'project-cost-control', …]` — a project's cost-control report
 *   (`projectCostControl`).
 * - `['finance', 'settings']` — finance settings (`settings`).
 * - `['finance', 'reports', …]` — trial balance, P&L, balance sheet.
 */

import type { CustomerListParams } from '../../services/finance-customer-service';
import type { ConstructionInvoiceListParams } from '../../services/finance-construction-invoice-service';
import type { ExpensePageParams } from '../../services/finance-expense-service';
import type { InvoiceListParams } from '../../services/finance-invoice-service';
import type { ReceiptPageParams } from '../../services/finance-receipt-service';

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
  invoicesList: (params?: InvoiceListParams) =>
    [...financeKeys.invoices(), 'list', params ?? {}] as const,
  invoice: (id: string) => [...financeKeys.invoices(), 'detail', id] as const,

  // Payments
  payments: () => [...financeKeys.all, 'payments'] as const,
  payment: (id: string) => [...financeKeys.payments(), 'detail', id] as const,

  // Construction invoices
  constructionInvoices: () =>
    [...financeKeys.all, 'construction-invoices'] as const,
  constructionInvoicesList: (params?: ConstructionInvoiceListParams) =>
    [...financeKeys.constructionInvoices(), 'list', params ?? {}] as const,
  constructionInvoice: (id: string) =>
    [...financeKeys.constructionInvoices(), 'detail', id] as const,

  // Expenses
  expenses: () => [...financeKeys.all, 'expenses'] as const,
  expensesList: () => [...financeKeys.expenses(), 'list'] as const,
  expensesPage: (params?: ExpensePageParams) =>
    [...financeKeys.expenses(), 'page', params ?? {}] as const,
  expense: (id: number) => [...financeKeys.expenses(), 'detail', id] as const,

  // Receipts
  receipts: () => [...financeKeys.all, 'receipts'] as const,
  receiptsList: () => [...financeKeys.receipts(), 'list'] as const,
  receiptsPage: (params?: ReceiptPageParams) =>
    [...financeKeys.receipts(), 'page', params ?? {}] as const,
  receipt: (id: number) => [...financeKeys.receipts(), 'detail', id] as const,

  // Journal entries
  journalEntries: () => [...financeKeys.all, 'journal-entries'] as const,
  journalEntriesList: (pageNo?: number, pageSize?: number) =>
    [...financeKeys.journalEntries(), 'list', { pageNo, pageSize }] as const,
  journalEntry: (id: string) =>
    [...financeKeys.journalEntries(), 'detail', id] as const,

  // Posting-account mappings
  postingAccounts: () => [...financeKeys.all, 'posting-accounts'] as const,
  postingAccountsList: () =>
    [...financeKeys.postingAccounts(), 'list'] as const,

  // Cost categories
  costCategories: () => [...financeKeys.all, 'cost-categories'] as const,
  costCategoriesList: (activeOnly?: boolean) =>
    [...financeKeys.costCategories(), 'list', { activeOnly }] as const,
  costCategory: (id: string) =>
    [...financeKeys.costCategories(), 'detail', id] as const,

  // Project budget allocations
  projectBudgets: () => [...financeKeys.all, 'project-budgets'] as const,
  projectBudget: (projectId: number) =>
    [...financeKeys.projectBudgets(), projectId] as const,

  // Project cost-control reports
  projectCostControls: () =>
    [...financeKeys.all, 'project-cost-control'] as const,
  projectCostControl: (projectId: number) =>
    [...financeKeys.projectCostControls(), projectId] as const,

  // Finance settings
  settings: () => [...financeKeys.all, 'settings'] as const,

  // Reports
  reports: () => [...financeKeys.all, 'reports'] as const,
  trialBalance: (asOfDate: string) =>
    [...financeKeys.reports(), 'trial-balance', asOfDate] as const,
  profitAndLoss: (fromDate: string, toDate: string) =>
    [...financeKeys.reports(), 'profit-and-loss', fromDate, toDate] as const,
  balanceSheet: (asOfDate: string) =>
    [...financeKeys.reports(), 'balance-sheet', asOfDate] as const,
};
