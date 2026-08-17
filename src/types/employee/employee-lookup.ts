/**
 * @module types/employee/employee-lookup
 *
 * Minimal, non-sensitive employee projection for populating pickers (assignee,
 * inspector, payee, ...). It carries only id, employee id, name and designation,
 * so it can be read by any tenant member while the full {@link Employee} record
 * (contact details, salary, personal data) is restricted to management roles.
 *
 * @see {@link parseEmployeeLookup}
 * @see employeeService.getLookup
 */

import { z } from 'zod';
import { nullableString, opaque } from '../../lib/validation/backend-schema';
import { parsePositiveInt } from '../../lib/utils/parse-id';

/** Shape of the backend `EmployeeLookupDto` at the parse boundary. */
const EmployeeLookupResponseSchema = z.object({
  id: opaque,
  employeeId: nullableString,
  employeeName: nullableString,
  designation: nullableString,
  organizationId: opaque,
});

export interface EmployeeLookup {
  id: number;
  employeeId: string;
  name: string;
  designation: string;
  organizationId: number;
}

/**
 * Parses a backend `EmployeeLookupDto` into an {@link EmployeeLookup}. Renames
 * `employeeName` to `name` to match the full {@link Employee} type so the two are
 * interchangeable at picker call sites.
 */
export function parseEmployeeLookup(json: unknown): EmployeeLookup {
  const raw = EmployeeLookupResponseSchema.parse(json);
  const id = parsePositiveInt(raw.id, 'parseEmployeeLookup.id');
  return {
    id,
    employeeId: raw.employeeId ?? String(id),
    name: raw.employeeName ?? '',
    designation: raw.designation ?? '',
    organizationId: parsePositiveInt(
      raw.organizationId,
      'parseEmployeeLookup.organizationId'
    ),
  };
}
