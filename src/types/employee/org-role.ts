/**
 * @module types/employee/org-role
 *
 * Authorisation roles assigned to employees via `Employee.orgRoles`.
 *
 * Values are UPPERCASE_SNAKE_CASE strings sent verbatim by the backend.
 * The enum is closed; additions require backend coordination.
 *
 * Grouped {@link ADMIN_ROLES}, {@link MANAGER_ROLES}, etc. are the
 * permission cohorts used by the RBAC helpers
 * ({@link isAdmin}, {@link isManager}, ...).
 */

/**
 * Authorisation role assigned to an employee.
 *
 * Members are grouped by job family (general workers, skilled trades,
 * equipment operators, office staff, leadership, engineering, supervisory,
 * third-party, trainees). Use {@link getOrgRoleLabel} for display and the
 * group-membership helpers for permission checks.
 */
export enum OrgRole {
  // ── General Workers ──
  /** Manual labourer / general site worker. */
  LABORER = 'LABORER',
  /** Hands-on assistant to skilled workers. */
  HELPER = 'HELPER',
  /** Site cleaning and housekeeping. */
  SITE_CLEANER = 'SITE_CLEANER',
  /** Site security personnel. */
  SECURITY_GUARD = 'SECURITY_GUARD',

  // ── Skilled Workers ──
  /** Electrical wiring and installation. */
  ELECTRICIAN = 'ELECTRICIAN',
  /** Plumbing installation and repair. */
  PLUMBER = 'PLUMBER',
  /** Carpentry and woodwork. */
  CARPENTER = 'CARPENTER',
  /** Masonry and brickwork. */
  MASON = 'MASON',
  /** Welding (arc/MIG/TIG). */
  WELDER = 'WELDER',
  /** Surface preparation and painting. */
  PAINTER = 'PAINTER',
  /** Scaffold erection / inspection. */
  SCAFFOLDER = 'SCAFFOLDER',

  // ── Equipment Operators ──
  /** Generic heavy-equipment operator. */
  EQUIPMENT_OPERATOR = 'EQUIPMENT_OPERATOR',
  /** Crane operator (mobile / tower). */
  CRANE_OPERATOR = 'CRANE_OPERATOR',
  /** Vehicle driver (transport / haulage). */
  DRIVER = 'DRIVER',

  // ── Office & Admin ──
  /** HR administrator (people-ops; manager-tier permissions). */
  HR_ADMIN = 'HR_ADMIN',
  /** Accounting / bookkeeping staff. */
  ACCOUNTANT = 'ACCOUNTANT',
  /** General office administration. */
  ADMIN_STAFF = 'ADMIN_STAFF',
  /** Reception / visitor management. */
  RECEPTIONIST = 'RECEPTIONIST',
  /** Document control and records management. */
  DOCUMENT_CONTROLLER = 'DOCUMENT_CONTROLLER',
  /** IT helpdesk / desktop support. */
  IT_SUPPORT = 'IT_SUPPORT',
  /** Office assistant / clerical support. */
  OFFICE_ASSISTANT = 'OFFICE_ASSISTANT',

  // ── Leadership ──
  /** Board / executive director — admin tier. */
  DIRECTOR = 'DIRECTOR',
  /** Platform system administrator — admin tier. */
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',

  // ── Engineering & Technical ──
  /** Civil engineering. */
  CIVIL_ENGINEER = 'CIVIL_ENGINEER',
  /** On-site engineering execution. */
  SITE_ENGINEER = 'SITE_ENGINEER',
  /** Structural engineering. */
  STRUCTURAL_ENGINEER = 'STRUCTURAL_ENGINEER',
  /** Architecture / design. */
  ARCHITECT = 'ARCHITECT',
  /** Quantity surveying / cost engineering. */
  QUANTITY_SURVEYOR = 'QUANTITY_SURVEYOR',
  /** Site safety and EHS oversight. */
  SAFETY_OFFICER = 'SAFETY_OFFICER',
  /** Planning and scheduling engineer. */
  PLANNING_ENGINEER = 'PLANNING_ENGINEER',
  /** Technical coordination between trades. */
  TECHNICAL_COORDINATOR = 'TECHNICAL_COORDINATOR',

  // ── Management & Supervisory ──
  /** Project manager — manager tier. */
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  /** Site manager — manager tier. */
  SITE_MANAGER = 'SITE_MANAGER',
  /** Site supervisor — supervisor tier. */
  SITE_SUPERVISOR = 'SITE_SUPERVISOR',
  /** Generic supervisor — supervisor tier. */
  SUPERVISOR = 'SUPERVISOR',
  /** Foreman / crew lead — supervisor tier. */
  FOREMAN = 'FOREMAN',

  // ── Third Party ──
  /** Main contractor entity. */
  CONTRACTOR = 'CONTRACTOR',
  /** Sub-contractor entity. */
  SUB_CONTRACTOR = 'SUB_CONTRACTOR',
  /** Material supplier. */
  MATERIAL_SUPPLIER = 'MATERIAL_SUPPLIER',
  /** Procurement officer (third-party context). */
  PROCUREMENT_OFFICER = 'PROCUREMENT_OFFICER',
  /** Generic vendor. */
  VENDOR = 'VENDOR',
  /** External consultant. */
  CONSULTANT = 'CONSULTANT',
  /** Project owner's representative. */
  OWNER_REPRESENTATIVE = 'OWNER_REPRESENTATIVE',
  /** Client-side stakeholder. */
  CLIENT = 'CLIENT',

  // ── Trainees ──
  /** Student on placement. */
  STUDENT = 'STUDENT',
  /** Intern (short-term placement). */
  INTERN = 'INTERN',
  /** Formal trainee on a development programme. */
  TRAINEE = 'TRAINEE',
}

const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  [OrgRole.LABORER]: 'Laborer',
  [OrgRole.HELPER]: 'Helper',
  [OrgRole.SITE_CLEANER]: 'Site Cleaner',
  [OrgRole.SECURITY_GUARD]: 'Security Guard',
  [OrgRole.ELECTRICIAN]: 'Electrician',
  [OrgRole.PLUMBER]: 'Plumber',
  [OrgRole.CARPENTER]: 'Carpenter',
  [OrgRole.MASON]: 'Mason',
  [OrgRole.WELDER]: 'Welder',
  [OrgRole.PAINTER]: 'Painter',
  [OrgRole.SCAFFOLDER]: 'Scaffolder',
  [OrgRole.EQUIPMENT_OPERATOR]: 'Equipment Operator',
  [OrgRole.CRANE_OPERATOR]: 'Crane Operator',
  [OrgRole.DRIVER]: 'Driver',
  [OrgRole.HR_ADMIN]: 'HR Manager',
  [OrgRole.ACCOUNTANT]: 'Accountant',
  [OrgRole.ADMIN_STAFF]: 'Admin Staff',
  [OrgRole.RECEPTIONIST]: 'Receptionist',
  [OrgRole.DOCUMENT_CONTROLLER]: 'Document Controller',
  [OrgRole.IT_SUPPORT]: 'IT Support',
  [OrgRole.OFFICE_ASSISTANT]: 'Office Assistant',
  [OrgRole.DIRECTOR]: 'Director',
  [OrgRole.SYSTEM_ADMIN]: 'System Administrator',
  [OrgRole.CIVIL_ENGINEER]: 'Civil Engineer',
  [OrgRole.SITE_ENGINEER]: 'Site Engineer',
  [OrgRole.STRUCTURAL_ENGINEER]: 'Structural Engineer',
  [OrgRole.ARCHITECT]: 'Architect',
  [OrgRole.QUANTITY_SURVEYOR]: 'Quantity Surveyor',
  [OrgRole.SAFETY_OFFICER]: 'Safety Officer',
  [OrgRole.PLANNING_ENGINEER]: 'Planning Engineer',
  [OrgRole.TECHNICAL_COORDINATOR]: 'Technical Coordinator',
  [OrgRole.PROJECT_MANAGER]: 'Project Manager',
  [OrgRole.SITE_MANAGER]: 'Site Manager',
  [OrgRole.SITE_SUPERVISOR]: 'Site Supervisor',
  [OrgRole.SUPERVISOR]: 'Supervisor',
  [OrgRole.FOREMAN]: 'Foreman',
  [OrgRole.CONTRACTOR]: 'Contractor',
  [OrgRole.SUB_CONTRACTOR]: 'Sub Contractor',
  [OrgRole.MATERIAL_SUPPLIER]: 'Material Supplier',
  [OrgRole.PROCUREMENT_OFFICER]: 'Procurement Officer',
  [OrgRole.VENDOR]: 'Vendor',
  [OrgRole.CONSULTANT]: 'Consultant',
  [OrgRole.OWNER_REPRESENTATIVE]: 'Owner Representative',
  [OrgRole.CLIENT]: 'Client',
  [OrgRole.STUDENT]: 'Student',
  [OrgRole.INTERN]: 'Intern',
  [OrgRole.TRAINEE]: 'Trainee',
};

// ==================== Role Groups ====================

/** System admin and director-level roles. Top-tier permissions. */
export const ADMIN_ROLES: ReadonlySet<OrgRole> = new Set([
  OrgRole.SYSTEM_ADMIN,
  OrgRole.DIRECTOR,
]);

/** Managerial roles that can approve, assign, and oversee teams. */
export const MANAGER_ROLES: ReadonlySet<OrgRole> = new Set([
  OrgRole.PROJECT_MANAGER,
  OrgRole.SITE_MANAGER,
  OrgRole.HR_ADMIN,
]);

/** Supervisory roles that oversee day-to-day work on site. */
export const SUPERVISOR_ROLES: ReadonlySet<OrgRole> = new Set([
  OrgRole.SITE_SUPERVISOR,
  OrgRole.SUPERVISOR,
  OrgRole.FOREMAN,
]);

/** Engineering and technical specialist roles. */
export const ENGINEERING_ROLES: ReadonlySet<OrgRole> = new Set([
  OrgRole.CIVIL_ENGINEER,
  OrgRole.SITE_ENGINEER,
  OrgRole.STRUCTURAL_ENGINEER,
  OrgRole.ARCHITECT,
  OrgRole.QUANTITY_SURVEYOR,
  OrgRole.SAFETY_OFFICER,
  OrgRole.PLANNING_ENGINEER,
  OrgRole.TECHNICAL_COORDINATOR,
]);

/** Safety and quality inspection roles. */
export const INSPECTOR_ROLES: ReadonlySet<OrgRole> = new Set([
  OrgRole.SAFETY_OFFICER,
  OrgRole.QUANTITY_SURVEYOR,
]);

/** All remaining roles that don't fall into a privileged group. */
export const NORMAL_ROLES: ReadonlySet<OrgRole> = new Set([
  OrgRole.LABORER,
  OrgRole.HELPER,
  OrgRole.SITE_CLEANER,
  OrgRole.SECURITY_GUARD,
  OrgRole.ELECTRICIAN,
  OrgRole.PLUMBER,
  OrgRole.CARPENTER,
  OrgRole.MASON,
  OrgRole.WELDER,
  OrgRole.PAINTER,
  OrgRole.SCAFFOLDER,
  OrgRole.EQUIPMENT_OPERATOR,
  OrgRole.CRANE_OPERATOR,
  OrgRole.DRIVER,
  OrgRole.ACCOUNTANT,
  OrgRole.ADMIN_STAFF,
  OrgRole.RECEPTIONIST,
  OrgRole.DOCUMENT_CONTROLLER,
  OrgRole.IT_SUPPORT,
  OrgRole.OFFICE_ASSISTANT,
  OrgRole.CONTRACTOR,
  OrgRole.SUB_CONTRACTOR,
  OrgRole.MATERIAL_SUPPLIER,
  OrgRole.PROCUREMENT_OFFICER,
  OrgRole.VENDOR,
  OrgRole.CONSULTANT,
  OrgRole.OWNER_REPRESENTATIVE,
  OrgRole.CLIENT,
  OrgRole.STUDENT,
  OrgRole.INTERN,
  OrgRole.TRAINEE,
]);

// ==================== Group Check Helpers ====================

/** Check if any of the user's roles belong to a given group. */
function hasRoleInGroup(
  roles: string[] | undefined,
  group: ReadonlySet<OrgRole>
): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => group.has(r as OrgRole));
}

/**
 * Whether the role list contains any {@link ADMIN_ROLES} member.
 *
 * @param roles - Raw role strings from `Employee.orgRoles`.
 * @returns `true` if at least one role is admin-tier.
 */
export const isAdmin = (roles: string[] | undefined) =>
  hasRoleInGroup(roles, ADMIN_ROLES);

/**
 * Whether the role list contains any {@link MANAGER_ROLES} member.
 *
 * @param roles - Raw role strings from `Employee.orgRoles`.
 * @returns `true` if at least one role is manager-tier.
 */
export const isManager = (roles: string[] | undefined) =>
  hasRoleInGroup(roles, MANAGER_ROLES);

/**
 * Whether the role list contains any {@link SUPERVISOR_ROLES} member.
 *
 * @param roles - Raw role strings from `Employee.orgRoles`.
 * @returns `true` if at least one role is supervisor-tier.
 */
export const isSupervisor = (roles: string[] | undefined) =>
  hasRoleInGroup(roles, SUPERVISOR_ROLES);

/**
 * Whether the role list contains any {@link ENGINEERING_ROLES} member.
 *
 * @param roles - Raw role strings from `Employee.orgRoles`.
 * @returns `true` if at least one role is an engineering specialist.
 */
export const isEngineer = (roles: string[] | undefined) =>
  hasRoleInGroup(roles, ENGINEERING_ROLES);

/**
 * Whether the role list contains any {@link INSPECTOR_ROLES} member.
 *
 * @param roles - Raw role strings from `Employee.orgRoles`.
 * @returns `true` if at least one role is an inspector / surveyor.
 */
export const isInspector = (roles: string[] | undefined) =>
  hasRoleInGroup(roles, INSPECTOR_ROLES);

/**
 * Whether the user has at least manager-level access (admin OR manager).
 *
 * @param roles - Raw role strings from `Employee.orgRoles`.
 * @returns `true` for admin or manager tier.
 */
export const isManagerOrAbove = (roles: string[] | undefined) =>
  isAdmin(roles) || isManager(roles);

/**
 * Whether the user has at least supervisor-level access (admin OR manager
 * OR supervisor).
 *
 * @param roles - Raw role strings from `Employee.orgRoles`.
 * @returns `true` for any privileged tier above NORMAL.
 */
export const isSupervisorOrAbove = (roles: string[] | undefined) =>
  isAdmin(roles) || isManager(roles) || isSupervisor(roles);

// ==================== Labels & Parsing ====================

/**
 * Returns the human-readable display label for an {@link OrgRole}.
 *
 * @param role - The role to format.
 * @returns The display label, or the enum value itself if no label is mapped.
 */
export function getOrgRoleLabel(role: OrgRole): string {
  return ORG_ROLE_LABELS[role] ?? role;
}

/**
 * Narrows an untrusted string to an {@link OrgRole}.
 *
 * @param str - Raw role string from a JSON payload.
 * @returns The matching enum value, or `undefined` if `str` is not a known role.
 */
export function orgRoleFromString(str: string): OrgRole | undefined {
  const values = Object.values(OrgRole) as string[];
  return values.includes(str) ? (str as OrgRole) : undefined;
}
