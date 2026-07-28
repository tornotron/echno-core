/**
 * @module types/finance/reports
 *
 * Financial report shapes and parsers: {@link TrialBalanceReport} (backend
 * `TrialBalanceReport`), {@link ProfitAndLossReport}, and
 * {@link BalanceSheetReport}, plus the shared {@link AccountLine} and
 * {@link TrialBalanceRow} rows. These are read-only report projections with no
 * surrogate id, so no id validation is applied.
 */

import { AccountType, parseAccountType } from './finance-enums';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** One account's contribution to a P&L or balance-sheet section. */
export interface AccountLine {
  /** Account code. */
  accountCode: string;
  /** Account name. */
  accountName: string;
  /** Amount for the account in this section. */
  amount: number;
}

/** Parses a raw account-line payload into a typed {@link AccountLine}. */
export function parseAccountLine(json: any): AccountLine {
  return {
    accountCode: json.accountCode ?? '',
    accountName: json.accountName ?? '',
    amount: json.amount ?? 0,
  };
}

/** One row of a trial balance. */
export interface TrialBalanceRow {
  /** Account code. */
  accountCode: string;
  /** Account name. */
  accountName: string;
  /** Ledger classification. */
  type: AccountType;
  /** Total debits posted to the account. */
  totalDebit: number;
  /** Total credits posted to the account. */
  totalCredit: number;
  /** Net debit balance (if the account nets debit). */
  debitBalance: number;
  /** Net credit balance (if the account nets credit). */
  creditBalance: number;
}

/** Parses a raw trial-balance row into a typed {@link TrialBalanceRow}. */
export function parseTrialBalanceRow(json: any): TrialBalanceRow {
  return {
    accountCode: json.accountCode ?? '',
    accountName: json.accountName ?? '',
    type: parseAccountType(json.type),
    totalDebit: json.totalDebit ?? 0,
    totalCredit: json.totalCredit ?? 0,
    debitBalance: json.debitBalance ?? 0,
    creditBalance: json.creditBalance ?? 0,
  };
}

/** Trial-balance report as of a date. */
export interface TrialBalanceReport {
  /** As-of date (`YYYY-MM-DD`). */
  asOfDate?: string;
  /** Per-account rows. */
  rows: TrialBalanceRow[];
  /** Sum of all debits. */
  totalDebit: number;
  /** Sum of all credits. */
  totalCredit: number;
  /** Whether debits equal credits. */
  balanced: boolean;
}

/** Parses a raw trial-balance payload into a typed {@link TrialBalanceReport}. */
export function parseTrialBalanceReport(json: any): TrialBalanceReport {
  return {
    asOfDate: json.asOfDate ?? undefined,
    rows: Array.isArray(json.rows)
      ? json.rows.map((r: any) => parseTrialBalanceRow(r))
      : [],
    totalDebit: json.totalDebit ?? 0,
    totalCredit: json.totalCredit ?? 0,
    balanced: json.balanced ?? false,
  };
}

/** Profit-and-loss report over a date range. */
export interface ProfitAndLossReport {
  /** Range start (`YYYY-MM-DD`). */
  fromDate?: string;
  /** Range end (`YYYY-MM-DD`). */
  toDate?: string;
  /** Income lines. */
  income: AccountLine[];
  /** Total income. */
  totalIncome: number;
  /** Expense lines. */
  expense: AccountLine[];
  /** Total expense. */
  totalExpense: number;
  /** Net profit (income − expense). */
  netProfit: number;
}

/** Parses a raw P&L payload into a typed {@link ProfitAndLossReport}. */
export function parseProfitAndLossReport(json: any): ProfitAndLossReport {
  return {
    fromDate: json.fromDate ?? undefined,
    toDate: json.toDate ?? undefined,
    income: Array.isArray(json.income)
      ? json.income.map((l: any) => parseAccountLine(l))
      : [],
    totalIncome: json.totalIncome ?? 0,
    expense: Array.isArray(json.expense)
      ? json.expense.map((l: any) => parseAccountLine(l))
      : [],
    totalExpense: json.totalExpense ?? 0,
    netProfit: json.netProfit ?? 0,
  };
}

/** Balance-sheet report as of a date. */
export interface BalanceSheetReport {
  /** As-of date (`YYYY-MM-DD`). */
  asOfDate?: string;
  /** Asset lines. */
  assets: AccountLine[];
  /** Total assets. */
  totalAssets: number;
  /** Liability lines. */
  liabilities: AccountLine[];
  /** Total liabilities. */
  totalLiabilities: number;
  /** Equity lines. */
  equity: AccountLine[];
  /** Total equity. */
  totalEquity: number;
  /** Retained earnings accrued over the period. */
  retainedEarningsForPeriod: number;
  /** Total liabilities plus equity. */
  totalLiabilitiesAndEquity: number;
  /** Whether assets equal liabilities plus equity. */
  balanced: boolean;
}

/** Parses a raw balance-sheet payload into a typed {@link BalanceSheetReport}. */
export function parseBalanceSheetReport(json: any): BalanceSheetReport {
  return {
    asOfDate: json.asOfDate ?? undefined,
    assets: Array.isArray(json.assets)
      ? json.assets.map((l: any) => parseAccountLine(l))
      : [],
    totalAssets: json.totalAssets ?? 0,
    liabilities: Array.isArray(json.liabilities)
      ? json.liabilities.map((l: any) => parseAccountLine(l))
      : [],
    totalLiabilities: json.totalLiabilities ?? 0,
    equity: Array.isArray(json.equity)
      ? json.equity.map((l: any) => parseAccountLine(l))
      : [],
    totalEquity: json.totalEquity ?? 0,
    retainedEarningsForPeriod: json.retainedEarningsForPeriod ?? 0,
    totalLiabilitiesAndEquity: json.totalLiabilitiesAndEquity ?? 0,
    balanced: json.balanced ?? false,
  };
}
