import { describe, expect, test } from 'bun:test';
import { parseEmployee } from './employee';

// Boundary validation for the employee parser: structural checks + money coercion
// on salary, instead of passing an any-typed payload straight through.
describe('parseEmployee boundary validation', () => {
  test('parses a valid response and coerces a string salary', () => {
    const employee = parseEmployee({
      id: 1,
      employeeName: 'Ravi',
      organizationId: 5,
      salary: '50000',
    });

    expect(employee.id).toBe(1);
    expect(employee.name).toBe('Ravi');
    expect(employee.organizationId).toBe(5);
    expect(employee.salary).toBe(50000);
  });

  test('rejects a missing id', () => {
    expect(() => parseEmployee({ organizationId: 5 })).toThrow();
  });

  test('rejects a missing organizationId', () => {
    expect(() => parseEmployee({ id: 1 })).toThrow();
  });
});
