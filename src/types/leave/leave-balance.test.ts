import { describe, expect, test } from 'bun:test';
import {
  parseLeaveBalance,
  parseLeaveBalanceSummary,
  parseLeaveTransaction,
} from './leave-balance';
import { TransactionType } from './leave-enums';

describe('parseLeaveBalance', () => {
  test('parses a minimal valid payload with defaults', () => {
    const balance = parseLeaveBalance({
      id: 1,
      employeeId: 2,
      leavePolicyId: 3,
    });
    expect(balance.leavePolicyId).toBe(3);
    expect(balance.used).toBe(0);
  });

  test('falls back to the nested leavePolicy.id', () => {
    const balance = parseLeaveBalance({
      id: 1,
      employeeId: 2,
      leavePolicy: { id: 9 },
    });
    expect(balance.leavePolicyId).toBe(9);
  });

  test('throws when the policy id cannot be resolved', () => {
    expect(() => parseLeaveBalance({ id: 1, employeeId: 2 })).toThrow();
  });
});

describe('parseLeaveTransaction', () => {
  test('defaults the transaction type', () => {
    const txn = parseLeaveTransaction({ id: 1, leaveBalanceId: 2 });
    expect(txn.transactionType).toBe(TransactionType.ADJUSTMENT);
  });

  test('throws on a non-positive id', () => {
    expect(() =>
      parseLeaveTransaction({ id: -1, leaveBalanceId: 2 })
    ).toThrow();
  });
});

describe('parseLeaveBalanceSummary', () => {
  test('parses nested balances', () => {
    const summary = parseLeaveBalanceSummary({
      employeeId: 5,
      balances: [{ id: 1, employeeId: 5, leavePolicyId: 3 }],
    });
    expect(summary.employeeId).toBe(5);
    expect(summary.balances).toHaveLength(1);
  });
});
