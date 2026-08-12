/**
 * @module types/finance/reports
 *
 * Financial report shapes and parsers: {@link TrialBalanceReport} (backend
 * `TrialBalanceReport`), {@link ProfitAndLossReport}, and
 * {@link BalanceSheetReport}, plus the shared {@link AccountLine} and
 * {@link TrialBalanceRow} rows. These are read-only report projections with no
 * surrogate id, so no id validation is applied.
 */

import { z } from 'zod';
import { AccountType, parseAccountType } from './finance-enums';
import {
  money,
  nullableBoolean,
  nullableString,
} from '../../lib/validation/backend-schema';

/** One account's contribution to a P&L or balance-sheet section. */
export interface AccountLine {
  /** Account code. */
  accountCode: string;
  /** Account name. */
  accountName: string;
  /** Amount for the account in this section. */
  amount: number;
}

const AccountLineResponseSchema = z.object({
  accountCode: nullableString,
  accountName: nullableString,
  amount: money,
});

/** Parses a raw account-line payload into a typed {@link AccountLine}. */
export function parseAccountLine(json: unknown): AccountLine {
  const raw = AccountLineResponseSchema.parse(json);
  return {
    accountCode: raw.accountCode ?? '',
    accountName: raw.accountName ?? '',
    amount: raw.amount ?? 0,
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

const TrialBalanceRowResponseSchema = z.object({
  accountCode: nullableString,
  accountName: nullableString,
  type: nullableString,
  totalDebit: money,
  totalCredit: money,
  debitBalance: money,
  creditBalance: money,
});

/** Parses a raw trial-balance row into a typed {@link TrialBalanceRow}. */
export function parseTrialBalanceRow(json: unknown): TrialBalanceRow {
  const raw = TrialBalanceRowResponseSchema.parse(json);
  return {
    accountCode: raw.accountCode ?? '',
    accountName: raw.accountName ?? '',
    type: parseAccountType(raw.type),
    totalDebit: raw.totalDebit ?? 0,
    totalCredit: raw.totalCredit ?? 0,
    debitBalance: raw.debitBalance ?? 0,
    creditBalance: raw.creditBalance ?? 0,
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

const TrialBalanceReportResponseSchema = z.object({
  asOfDate: nullableString,
  rows: z.array(z.unknown()).nullish(),
  totalDebit: money,
  totalCredit: money,
  balanced: nullableBoolean,
});

/** Parses a raw trial-balance payload into a typed {@link TrialBalanceReport}. */
export function parseTrialBalanceReport(json: unknown): TrialBalanceReport {
  const raw = TrialBalanceReportResponseSchema.parse(json);
  return {
    asOfDate: raw.asOfDate ?? undefined,
    rows: Array.isArray(raw.rows)
      ? raw.rows.map((r) => parseTrialBalanceRow(r))
      : [],
    totalDebit: raw.totalDebit ?? 0,
    totalCredit: raw.totalCredit ?? 0,
    balanced: raw.balanced ?? false,
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

const ProfitAndLossReportResponseSchema = z.object({
  fromDate: nullableString,
  toDate: nullableString,
  income: z.array(z.unknown()).nullish(),
  totalIncome: money,
  expense: z.array(z.unknown()).nullish(),
  totalExpense: money,
  netProfit: money,
});

/** Parses a raw P&L payload into a typed {@link ProfitAndLossReport}. */
export function parseProfitAndLossReport(json: unknown): ProfitAndLossReport {
  const raw = ProfitAndLossReportResponseSchema.parse(json);
  return {
    fromDate: raw.fromDate ?? undefined,
    toDate: raw.toDate ?? undefined,
    income: Array.isArray(raw.income)
      ? raw.income.map((l) => parseAccountLine(l))
      : [],
    totalIncome: raw.totalIncome ?? 0,
    expense: Array.isArray(raw.expense)
      ? raw.expense.map((l) => parseAccountLine(l))
      : [],
    totalExpense: raw.totalExpense ?? 0,
    netProfit: raw.netProfit ?? 0,
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

const BalanceSheetReportResponseSchema = z.object({
  asOfDate: nullableString,
  assets: z.array(z.unknown()).nullish(),
  totalAssets: money,
  liabilities: z.array(z.unknown()).nullish(),
  totalLiabilities: money,
  equity: z.array(z.unknown()).nullish(),
  totalEquity: money,
  retainedEarningsForPeriod: money,
  totalLiabilitiesAndEquity: money,
  balanced: nullableBoolean,
});

/** Parses a raw balance-sheet payload into a typed {@link BalanceSheetReport}. */
export function parseBalanceSheetReport(json: unknown): BalanceSheetReport {
  const raw = BalanceSheetReportResponseSchema.parse(json);
  return {
    asOfDate: raw.asOfDate ?? undefined,
    assets: Array.isArray(raw.assets)
      ? raw.assets.map((l) => parseAccountLine(l))
      : [],
    totalAssets: raw.totalAssets ?? 0,
    liabilities: Array.isArray(raw.liabilities)
      ? raw.liabilities.map((l) => parseAccountLine(l))
      : [],
    totalLiabilities: raw.totalLiabilities ?? 0,
    equity: Array.isArray(raw.equity)
      ? raw.equity.map((l) => parseAccountLine(l))
      : [],
    totalEquity: raw.totalEquity ?? 0,
    retainedEarningsForPeriod: raw.retainedEarningsForPeriod ?? 0,
    totalLiabilitiesAndEquity: raw.totalLiabilitiesAndEquity ?? 0,
    balanced: raw.balanced ?? false,
  };
}
