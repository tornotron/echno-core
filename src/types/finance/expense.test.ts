import { describe, expect, test } from 'bun:test';
import {
  parseExpense,
  createExpenseToJson,
  ExpenseType,
  ExpenseCategory,
  ExpenseStatus,
} from './expense';

// The backend serializes the BigDecimal amount as a string and sends the
// lowercase enum vocabulary; the boundary coerces the amount to a number, the
// timestamps to Date, and narrows the enums with a sensible default.
describe('parseExpense', () => {
  test('parses a valid payload with enums, money and dates', () => {
    const expense = parseExpense({
      id: 42,
      expenseNumber: 'EXP-2027-000001',
      type: 'direct',
      category: 'materials',
      status: 'pending',
      description: 'Cement and steel for Block C slab',
      amount: '45000.00',
      currency: 'INR',
      expenseDate: '2026-08-20',
      projectId: 3,
      vendorId: 12,
      createdAt: '2026-08-20T09:00:00',
      updatedAt: '2026-08-22T14:20:00',
    });
    expect(expense.id).toBe(42);
    expect(expense.expenseNumber).toBe('EXP-2027-000001');
    expect(expense.type).toBe(ExpenseType.direct);
    expect(expense.category).toBe(ExpenseCategory.materials);
    expect(expense.status).toBe(ExpenseStatus.pending);
    expect(expense.amount).toBe(45000);
    expect(expense.currency).toBe('INR');
    expect(expense.projectId).toBe(3);
    expect(expense.vendorId).toBe(12);
    expect(expense.expenseDate).toBeInstanceOf(Date);
    expect(expense.createdAt).toBeInstanceOf(Date);
    // The naive server timestamp is read as UTC.
    expect(expense.createdAt.toISOString()).toBe('2026-08-20T09:00:00.000Z');
    expect(expense.updatedAt?.toISOString()).toBe('2026-08-22T14:20:00.000Z');
  });

  test('coerces a string-serialized amount to a number', () => {
    expect(parseExpense({ id: 1, amount: '1500.50' }).amount).toBe(1500.5);
  });

  test('defaults a missing amount to 0 and currency to INR', () => {
    const expense = parseExpense({ id: 1 });
    expect(expense.amount).toBe(0);
    expect(expense.currency).toBe('INR');
  });

  test('falls back to default enums on an unknown or absent value', () => {
    const expense = parseExpense({ id: 1, type: 'BOGUS' });
    expect(expense.type).toBe(ExpenseType.direct);
    expect(expense.category).toBe(ExpenseCategory.other);
    expect(expense.status).toBe(ExpenseStatus.draft);
  });

  test('leaves optional links and dates undefined when absent', () => {
    const expense = parseExpense({ id: 1 });
    expect(expense.projectId).toBeUndefined();
    expect(expense.vendorId).toBeUndefined();
    expect(expense.expenseDate).toBeUndefined();
    expect(expense.updatedAt).toBeUndefined();
  });

  test('rejects a missing id instead of fabricating one', () => {
    expect(() => parseExpense({ amount: 10 })).toThrow();
  });

  test('rejects a non-positive id', () => {
    expect(() => parseExpense({ id: 0 })).toThrow();
  });
});

describe('createExpenseToJson', () => {
  test('always emits the required fields and only set optionals', () => {
    const json = createExpenseToJson({
      description: 'Diesel for the generator',
      amount: 3200,
      category: ExpenseCategory.utilities,
      projectId: 5,
    });
    expect(json.description).toBe('Diesel for the generator');
    expect(json.amount).toBe(3200);
    expect(json.category).toBe('utilities');
    expect(json.projectId).toBe(5);
    expect('vendorId' in json).toBe(false);
    expect('status' in json).toBe(false);
  });
});
