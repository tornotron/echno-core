import { describe, expect, test } from 'bun:test';
import {
  parseFinanceSettings,
  updateFinanceSettingsToJson,
} from './finance-settings';

describe('parseFinanceSettings', () => {
  test('parses a numeric threshold', () => {
    expect(parseFinanceSettings({ approvalThreshold: 50000 })).toEqual({
      approvalThreshold: 50000,
    });
  });

  test('coerces a missing threshold to null', () => {
    expect(parseFinanceSettings({})).toEqual({ approvalThreshold: null });
  });

  test('coerces a null threshold to null', () => {
    expect(parseFinanceSettings({ approvalThreshold: null })).toEqual({
      approvalThreshold: null,
    });
  });
});

describe('updateFinanceSettingsToJson', () => {
  test('always emits approvalThreshold, including null', () => {
    expect(updateFinanceSettingsToJson({ approvalThreshold: null })).toEqual({
      approvalThreshold: null,
    });
    expect(updateFinanceSettingsToJson({ approvalThreshold: 1000 })).toEqual({
      approvalThreshold: 1000,
    });
  });
});
