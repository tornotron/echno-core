/**
 * @module types/attendance/attendance-summary
 *
 * The monthly {@link AttendanceSummary} entity plus its per-project breakdown
 * ({@link ProjectAttendanceSummary}) and the salary derivation helper
 * {@link calculateMonthlySalary}.
 */

/** Attendance rollup for one project within a monthly summary. */
export interface ProjectAttendanceSummary {
  /** Project the rollup covers. */
  projectId: number;
  /** Denormalized project display name. */
  projectName: string;
  /** Days the employee worked on this project. */
  daysWorked: number;
  /** Hours the employee worked on this project. */
  hoursWorked: number;
  /** Overtime hours logged on this project. */
  overtimeHours: number;
  /** Attendance percentage for this project. */
  attendancePercentage: number;
}

/** One employee's aggregated attendance for a calendar month. */
export interface AttendanceSummary {
  /** Employee the summary covers. */
  employeeId: number;
  /** Denormalized employee display name. */
  employeeName: string;
  /** Month number (1–12). */
  month: number;
  /** Four-digit year. */
  year: number;

  /** Working days scheduled in the month. */
  totalWorkingDays: number;
  /** Days marked present. */
  presentDays: number;
  /** Days marked half-day. */
  halfDays: number;
  /** Days marked absent. */
  absentDays: number;
  /** Days covered by approved leave. */
  leaveDays: number;
  /** Weekly-off days. */
  weeklyOffs: number;
  /** Holiday days. */
  holidays: number;
  /** Days flagged as late arrivals. */
  lateDays: number;
  /** Days with overtime. */
  overtimeDays: number;

  /** Total hours worked across the month. */
  totalHoursWorked: number;
  /** Total overtime hours across the month. */
  totalOvertimeHours: number;
  /** Average hours worked per working day. */
  averageWorkHours: number;

  /** Weighted attendance percentage for the month. */
  attendancePercentage: number;
  /** Weighted count of effective (payable) work days. */
  effectiveWorkDays: number;

  /** Monthly base salary; present only when payroll fields are computed. */
  baseSalary?: number;
  /** Salary deducted for shortfall against working days. */
  attendanceDeductions?: number;
  /** Additional pay for overtime hours. */
  overtimePay?: number;
  /** Net payable salary after deductions and overtime. */
  netSalary?: number;
  /** Optional per-project attendance breakdown. */
  projectWiseAttendance?: ProjectAttendanceSummary[];
}

/**
 * Derives the monthly payroll fields (`effectiveWorkDays`,
 * `attendanceDeductions`, `overtimePay`, `netSalary`, `attendancePercentage`)
 * from the summary's `baseSalary` and day counts.
 *
 * Effective days credit present days fully, half-days at 0.5, paid categories
 * (leave, weekly off, holiday) fully, and late days at 0.9. Deductions and
 * overtime are prorated off a daily/hourly rate derived from `totalWorkingDays`
 * (overtime at 1.5× an 8-hour-day hourly rate).
 *
 * @param summary - The summary to enrich. Returned unchanged when `baseSalary`
 *   is not set; guarded to avoid `NaN`/`Infinity` when `totalWorkingDays <= 0`.
 * @returns A copy of the summary with the payroll fields populated.
 */
export function calculateMonthlySalary(
  summary: AttendanceSummary
): AttendanceSummary {
  if (summary.baseSalary === undefined) {
    return summary;
  }
  const baseSalary = summary.baseSalary;

  // Effective work days with weighted credit per category.
  let effectiveWorkDays = 0;
  effectiveWorkDays += summary.presentDays;
  effectiveWorkDays += summary.halfDays * 0.5;
  effectiveWorkDays += summary.leaveDays; // paid leave
  effectiveWorkDays += summary.weeklyOffs;
  effectiveWorkDays += summary.holidays;
  effectiveWorkDays += summary.lateDays * 0.9; // 10% deduction for late

  // Guard against zero working days (off-cycle / mid-month enrollment / data
  // glitches). Without this, the ratio derivations below would yield NaN /
  // Infinity which silently propagates through payroll.
  if (summary.totalWorkingDays <= 0) {
    return {
      ...summary,
      effectiveWorkDays,
      attendanceDeductions: 0,
      overtimePay: 0,
      netSalary: baseSalary,
      attendancePercentage: 0,
    };
  }

  const dailySalary = baseSalary / summary.totalWorkingDays;
  const attendanceDeductions =
    (summary.totalWorkingDays - effectiveWorkDays) * dailySalary;

  // Overtime pay at 1.5× hourly rate, assuming an 8-hour standard day.
  const hourlyRate = baseSalary / (summary.totalWorkingDays * 8);
  const overtimePay = summary.totalOvertimeHours * hourlyRate * 1.5;

  const netSalary = baseSalary - attendanceDeductions + overtimePay;

  return {
    ...summary,
    effectiveWorkDays,
    attendanceDeductions,
    overtimePay,
    netSalary,
    attendancePercentage: (effectiveWorkDays / summary.totalWorkingDays) * 100,
  };
}
