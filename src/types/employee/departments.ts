/**
 * @module types/employee/departments
 *
 * Canonical list of organisational departments an employee can belong to,
 * with a label helper for UI rendering.
 *
 * Values are camelCase strings matching the backend `Employee.department`
 * field. The enum is closed — adding a department requires backend
 * coordination so the codomain stays in sync.
 */

export enum Department {
  /** Software / civil / mechanical engineering teams. */
  engineering = 'engineering',

  /** On-site construction execution teams. */
  construction = 'construction',

  /** Site safety, EHS, and compliance teams. */
  safety = 'safety',

  /** Quality assurance and inspection teams. */
  quality = 'quality',

  /** Office administration and front-of-house support. */
  administration = 'administration',

  /** People operations — hiring, payroll, benefits. */
  humanResources = 'humanResources',

  /** Accounting, treasury, and FP&A. */
  finance = 'finance',

  /** Vendor sourcing and purchase-order management. */
  procurement = 'procurement',

  /** Project planning and scheduling teams. */
  planning = 'planning',

  /** Equipment / facility maintenance. */
  maintenance = 'maintenance',

  /** Site or office security. */
  security = 'security',

  /** Day-to-day operations management. */
  operations = 'operations',

  /** Information technology / IT support. */
  it = 'it',

  /** Legal counsel and contracts. */
  legal = 'legal',

  /** Marketing, communications, and brand. */
  marketing = 'marketing',
}

/**
 * Returns the human-friendly label for a {@link Department}, or
 * `'Unassigned'` when the input is `undefined`.
 *
 * @param dept - The department to format, or `undefined` for unassigned employees.
 * @returns The display label (e.g. `"Human Resources"`).
 */
export function getDepartmentLabel(dept: Department | undefined): string {
  if (!dept) return 'Unassigned';
  const map: Record<Department, string> = {
    [Department.engineering]: 'Engineering',
    [Department.construction]: 'Construction',
    [Department.safety]: 'Safety',
    [Department.quality]: 'Quality',
    [Department.administration]: 'Administration',
    [Department.humanResources]: 'Human Resources',
    [Department.finance]: 'Finance',
    [Department.procurement]: 'Procurement',
    [Department.planning]: 'Planning',
    [Department.maintenance]: 'Maintenance',
    [Department.security]: 'Security',
    [Department.operations]: 'Operations',
    [Department.it]: 'IT',
    [Department.legal]: 'Legal',
    [Department.marketing]: 'Marketing',
  };
  return map[dept];
}
