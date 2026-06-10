/**
 * @module labour-enums
 *
 * Closed string enums for the labour domain. Values match the backend's
 * SCREAMING_SNAKE_CASE wire format exactly, so they double as both the
 * runtime constant and the API payload.
 */

/**
 * How a labour worker is engaged for payroll and tenure tracking.
 */
export enum EmploymentType {
  /** Paid per worked day with no guaranteed hours. */
  DAILY_WAGE = 'DAILY_WAGE',

  /** Salaried with a recurring monthly payout. */
  MONTHLY = 'MONTHLY',

  /** Engaged for a defined contract period. */
  CONTRACT = 'CONTRACT',

  /** Paid per unit of work delivered. */
  PIECE_RATE = 'PIECE_RATE',
}

/**
 * Trade-skill tier used for pay-band assignment and task eligibility.
 */
export enum SkillLevel {
  /** No formal trade skill. */
  UNSKILLED = 'UNSKILLED',

  /** Partial trade skill — assists skilled workers. */
  SEMI_SKILLED = 'SEMI_SKILLED',

  /** Competent in a specific trade. */
  SKILLED = 'SKILLED',

  /** Specialist competence — supervises or trains. */
  HIGHLY_SKILLED = 'HIGHLY_SKILLED',
}

/**
 * Current employment lifecycle state of the labour record.
 */
export enum LabourStatus {
  /** Currently engaged and available for assignment. */
  ACTIVE = 'ACTIVE',

  /** Temporarily not in service but expected to return. */
  INACTIVE = 'INACTIVE',

  /** On approved leave; unavailable for assignment until return. */
  ON_LEAVE = 'ON_LEAVE',

  /** Permanently separated from the organisation. */
  TERMINATED = 'TERMINATED',
}
