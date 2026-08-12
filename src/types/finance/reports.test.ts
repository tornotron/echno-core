import { describe, expect, test } from 'bun:test';
import {
  parseAccountLine,
  parseBalanceSheetReport,
  parseProfitAndLossReport,
  parseTrialBalanceReport,
} from './reports';
import { AccountType } from './finance-enums';

describe('reports parsers', () => {
  test('parses a trial balance and coerces string amounts', () => {
    const report = parseTrialBalanceReport({
      asOfDate: '2026-03-31',
      totalDebit: '1000.00',
      totalCredit: 1000,
      balanced: true,
      rows: [
        { accountCode: '1000', type: 'ASSET', totalDebit: '500.00' },
      ],
    });
    expect(report.totalDebit).toBe(1000);
    expect(report.balanced).toBe(true);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].type).toBe(AccountType.ASSET);
    expect(report.rows[0].totalDebit).toBe(500);
  });

  test('parses P&L and balance-sheet lines', () => {
    const pnl = parseProfitAndLossReport({
      income: [{ accountCode: '4000', amount: 1200 }],
      totalIncome: 1200,
    });
    expect(pnl.income[0].amount).toBe(1200);

    const bs = parseBalanceSheetReport({ totalAssets: '300' });
    expect(bs.totalAssets).toBe(300);
  });

  test('rejects a non-numeric amount instead of yielding NaN', () => {
    expect(() => parseAccountLine({ amount: 'not-a-number' })).toThrow();
  });
});
