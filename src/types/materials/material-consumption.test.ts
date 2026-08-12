import { describe, expect, test } from 'bun:test';
import { ConsumptionType, parseMaterialConsumption } from './material-consumption';

const validPayload = {
  id: 1,
  consumptionDate: '2026-01-01',
  materialId: 2,
  materialName: 'Cement',
  quantity: '3.5',
  consumptionType: 'TRANSFERRED',
  createdBy: { id: 4, employeeName: 'Ravi' },
};

describe('parseMaterialConsumption', () => {
  test('parses a minimal valid payload and coerces quantity', () => {
    const c = parseMaterialConsumption(validPayload);
    expect(c.id).toBe(1);
    expect(c.quantity).toBe(3.5);
    expect(c.consumptionType).toBe(ConsumptionType.transferred);
    expect(c.createdBy.name).toBe('Ravi');
  });

  test('throws when materialId is not a positive integer', () => {
    expect(() =>
      parseMaterialConsumption({ ...validPayload, materialId: -1 })
    ).toThrow();
  });
});
