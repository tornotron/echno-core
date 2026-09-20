/**
 * @module holidays
 *
 * The organization's holiday calendar and working week (backend #838): the
 * {@link Holiday} entity as the backend publishes it, the {@link WorkingWeek}
 * setting, their request shapes, and the parsers. Holidays are organization
 * wide and one per date; the working week is Monday to Friday until the
 * organization changes it. Both feed the leave deduction rule.
 */

import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { parseLocalDate, parseUTCDate } from '../../lib/utils/date-helpers';
import {
  backendDate,
  nullableString,
  opaque,
} from '../../lib/validation/backend-schema';

/** A day of the week, spelled the way `java.time.DayOfWeek` publishes it. */
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

/** The seven days, Monday first, for iteration and ordering. */
export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

/** One declared holiday of the organization. */
export interface Holiday {
  /** Surrogate id. */
  id: number;
  /** Owning organization. */
  organizationId: number;
  /** The date, as a local calendar date. */
  holidayDate: Date;
  /** ISO `YYYY-MM-DD` form of {@link Holiday.holidayDate}, for keys and forms. */
  holidayDateIso: string;
  /** Name of the holiday. */
  name: string;
  /** A note about the holiday, when one was written. */
  description?: string;
  /** When the holiday was declared. */
  createdAt?: Date;
  /** When the holiday was last changed. */
  updatedAt?: Date;
}

/** Body of `POST /holidays/web` and `PUT /holidays/web/update`. */
export interface HolidayRequest {
  /** ISO `YYYY-MM-DD`. One holiday per date per organization. */
  holidayDate: string;
  name: string;
  description?: string;
}

/** The days of the week the organization works. */
export interface WorkingWeek {
  organizationId: number;
  /** In weekday order, Monday first. */
  workingDays: DayOfWeek[];
}

/** Body of `PUT /holidays/web/working-week`. At least one day. */
export interface WorkingWeekRequest {
  workingDays: DayOfWeek[];
}

const DayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

const HolidayResponseSchema = z.object({
  id: opaque,
  organizationId: opaque,
  holidayDate: nullableString,
  name: nullableString,
  description: nullableString,
  createdAt: backendDate,
  updatedAt: backendDate,
});

const WorkingWeekResponseSchema = z.object({
  organizationId: opaque,
  workingDays: z.array(z.unknown()).nullish(),
});

/**
 * Parses a raw holiday payload into a typed {@link Holiday}.
 *
 * Non-strict: unknown keys are stripped. `id`, `organizationId` and
 * `holidayDate` are required, since a holiday without a date is not one.
 *
 * @throws {Error} If `id` or `organizationId` is not a positive int, or the
 *   date is missing or unreadable.
 */
export function parseHoliday(json: unknown): Holiday {
  const raw = HolidayResponseSchema.parse(json);
  const holidayDate = parseLocalDate(raw.holidayDate);
  if (!raw.holidayDate || !holidayDate) {
    throw new Error('parseHoliday.holidayDate: missing or unreadable date');
  }
  return {
    id: parsePositiveInt(raw.id, 'parseHoliday.id'),
    organizationId: parsePositiveInt(
      raw.organizationId,
      'parseHoliday.organizationId'
    ),
    holidayDate,
    holidayDateIso: raw.holidayDate.slice(0, 10),
    name: raw.name ?? '',
    description: raw.description ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    updatedAt: parseUTCDate(raw.updatedAt) ?? undefined,
  };
}

/**
 * Parses the working-week payload. A day the enum does not know is dropped;
 * an empty or absent list reads as Monday to Friday, the backend's own
 * default, so a screen never shows a week with no working day.
 */
export function parseWorkingWeek(json: unknown): WorkingWeek {
  const raw = WorkingWeekResponseSchema.parse(json);
  const days = (raw.workingDays ?? [])
    .map((day) => DayOfWeekSchema.safeParse(day))
    .filter((result) => result.success)
    .map((result) => result.data);
  const ordered = DAYS_OF_WEEK.filter((day) => days.includes(day));
  return {
    organizationId: parsePositiveInt(
      raw.organizationId,
      'parseWorkingWeek.organizationId'
    ),
    workingDays: ordered.length > 0 ? ordered : DAYS_OF_WEEK.slice(0, 5),
  };
}

/** Serializes a {@link HolidayRequest}; an empty note is left out. */
export function holidayRequestToJson(
  req: HolidayRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    holidayDate: req.holidayDate,
    name: req.name,
  };
  if (req.description !== undefined && req.description !== '') {
    json.description = req.description;
  }
  return json;
}
