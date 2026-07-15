/**
 * @module types/attendance/attendance-report
 *
 * The {@link AttendanceReport} entity — a wide date-range analytics rollup used
 * by attendance dashboards.
 */

import { AttendanceStatus } from "./attendance-status";


/** Aggregated attendance analytics over a date range. */
export interface AttendanceReport {
  /** Inclusive start of the reporting period. */
  startDate: Date;
  /** Inclusive end of the reporting period. */
  endDate: Date;
  /** Number of employees covered by the report. */
  totalEmployees: number;
  /** Average attendance percentage across the period. */
  averageAttendance: number;

  /** Count per status across the period. */
  statusCounts: Record<AttendanceStatus, number>;

  /** Per-project attendance rollups. */
  projectSummaries: {
    /** Project the rollup covers. */
    projectId: number;
    /** Denormalized project display name. */
    projectName: string;
    /** Total attendance records for the project. */
    totalAttendance: number;
    /** Average attendance percentage for the project. */
    averageAttendance: number;
    /** Distinct employees with attendance on the project. */
    employeeCount: number;
  }[];

  /** Day-by-day attendance trend points. */
  dailyTrends: {
    /** The calendar day. */
    date: Date;
    /** Employees present that day. */
    presentCount: number;
    /** Employees absent that day. */
    absentCount: number;
    /** Employees flagged late that day. */
    lateCount: number;
    /** Average hours worked that day. */
    averageWorkHours: number;
  }[];

  /** Highest-attendance employees over the period. */
  topPerformers: {
    /** Employee identifier. */
    employeeId: string;
    /** Denormalized employee display name. */
    employeeName: string;
    /** Attendance percentage for the employee. */
    attendancePercentage: number;
    /** Total hours worked by the employee. */
    totalHours: number;
  }[];

  /** Employees flagged with recurring attendance issues. */
  issues: {
    /** Employee identifier. */
    employeeId: string;
    /** Denormalized employee display name. */
    employeeName: string;
    /** Category of the recurring issue. */
    issueType: 'frequent_absence' | 'frequent_late' | 'missing_clockout';
    /** Number of times the issue occurred in the period. */
    occurrenceCount: number;
  }[];
}
