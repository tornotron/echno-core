import { describe, expect, test } from 'bun:test';
import { parseInvitation } from './invitation';

// The boundary validates the payload shape: nested employee details come
// through, a string-serialized salary is coerced to a number, and a
// malformed numeric id fails fast instead of becoming a fabricated value.
describe('parseInvitation', () => {
  test('parses a minimal valid payload with nested employee details', () => {
    const inv = parseInvitation({
      code: 'ABC123',
      employeeDetails: {
        department: 'Civil',
        designation: 'Engineer',
        salary: '25000',
      },
    });
    expect(inv.inviteCode).toBe('ABC123');
    expect(inv.employeeDetails.department).toBe('Civil');
    expect(inv.employeeDetails.salary).toBe(25000);
  });

  test('rejects a non-positive organizationId', () => {
    expect(() => parseInvitation({ organizationId: -5 })).toThrow();
  });
});
