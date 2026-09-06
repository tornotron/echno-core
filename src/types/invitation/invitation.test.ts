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

  // The backend's ProjectInviteCodeDto.code is an `int`, so a generated code
  // reaches the client as a JSON number, not a string. A schema that only
  // accepted strings threw here, and the service turned that into a 422 for
  // every code the console generated or listed.
  test('accepts the numeric code the backend sends and normalizes it to a string', () => {
    const inv = parseInvitation({
      code: 48213,
      employeeDetails: { department: 'Civil', designation: 'Engineer' },
    });
    expect(inv.inviteCode).toBe('48213');
  });

  // The backend's code is under discussion for widening to an opaque string.
  // The same schema has to keep working when that lands.
  test('accepts a string code, so a widened backend code still parses', () => {
    const inv = parseInvitation({ code: 'K7X2QF9M' });
    expect(inv.inviteCode).toBe('K7X2QF9M');
  });

  // Accepting both shapes must not become accepting anything: a structurally
  // wrong code has to fail at the boundary rather than stringify to
  // '[object Object]' and travel on as a plausible-looking value.
  test('rejects a code that is neither a string nor a number', () => {
    expect(() => parseInvitation({ code: { value: 48213 } })).toThrow();
  });

  test('rejects a non-positive organizationId', () => {
    expect(() => parseInvitation({ organizationId: -5 })).toThrow();
  });
});
