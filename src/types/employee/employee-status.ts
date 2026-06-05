/**
 * @module types/employee/employee-status
 *
 * Employment lifecycle status values plus presentation and parsing helpers.
 *
 * Values are camelCase strings, matching the backend `Employee.status` field.
 * Use {@link getEmployeeStatusLabel} for UI labels and
 * {@link getEmployeeStatusColor} for the badge swatch.
 */

export enum EmployeeStatus {
  /** Currently employed and actively working. */
  active = 'active',

  /** Employed but not currently engaged (e.g. dormant or paused). */
  inactive = 'inactive',

  /** Employed but on approved leave (sick, sabbatical, parental, etc.). */
  onLeave = 'onLeave',

  /** Employment ended by the employer. */
  terminated = 'terminated',

  /** Employment ended by the employee. */
  resigned = 'resigned',

  /** Employed under probationary trial period. */
  probation = 'probation',

  /** Employment temporarily suspended pending review. */
  suspended = 'suspended',
}

/**
 * Returns the human-friendly label for an {@link EmployeeStatus}.
 *
 * @param status - The status to format.
 * @returns The display label (e.g. `"On Leave"`).
 */
export function getEmployeeStatusLabel(status: EmployeeStatus): string {
  const map: Record<EmployeeStatus, string> = {
    [EmployeeStatus.active]: 'Active',
    [EmployeeStatus.inactive]: 'Inactive',
    [EmployeeStatus.onLeave]: 'On Leave',
    [EmployeeStatus.terminated]: 'Terminated',
    [EmployeeStatus.resigned]: 'Resigned',
    [EmployeeStatus.probation]: 'Probation',
    [EmployeeStatus.suspended]: 'Suspended',
  };
  return map[status];
}

/**
 * Returns a hex colour swatch for an {@link EmployeeStatus} badge.
 *
 * @param status - The status to map.
 * @returns A `#rrggbb` colour string.
 */
export function getEmployeeStatusColor(status: EmployeeStatus): string {
  const map: Record<EmployeeStatus, string> = {
    [EmployeeStatus.active]: '#4CAF50',
    [EmployeeStatus.inactive]: '#9E9E9E',
    [EmployeeStatus.onLeave]: '#FF9800',
    [EmployeeStatus.terminated]: '#F44336',
    [EmployeeStatus.resigned]: '#E91E63',
    [EmployeeStatus.probation]: '#2196F3',
    [EmployeeStatus.suspended]: '#795548',
  };
  return map[status];
}

/**
 * Narrows an untrusted string to an {@link EmployeeStatus}, defaulting to
 * {@link EmployeeStatus.active} for unknown values.
 *
 * The lenient default exists because the backend has occasionally returned
 * legacy or capitalised values; callers want a safe Employee object rather
 * than a runtime exception.
 *
 * @param str - Raw status string from a JSON payload.
 * @returns A valid status; falls back to `active` for unrecognised input.
 */
export function employeeStatusFromString(str: string): EmployeeStatus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (EmployeeStatus as any)[str];
  if (!status) return EmployeeStatus.active;
  return status;
}
