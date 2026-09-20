/**
 * @module holidays-service
 *
 * Typed client for the holiday calendar web endpoints (`/holidays/web`,
 * backend #838): the year's holidays, one holiday, declare, change and remove,
 * and the organization's working week.
 *
 * Every function throws {@link ApiError} on a non-2xx response or a parse
 * failure.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Holiday,
  HolidayRequest,
  WorkingWeek,
  WorkingWeekRequest,
  holidayRequestToJson,
  parseHoliday,
  parseWorkingWeek,
} from '../types/holidays/holidays';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/holidays/web';

function parseWith<T>(what: string, data: unknown, parse: (raw: unknown) => T): T {
  try {
    return parse(data);
  } catch (error) {
    logger.error(`Failed to parse ${what}:`, error);
    throw new ApiError(`Failed to process ${what} data. Please try again.`, 422);
  }
}

export const holidaysService = {
  /**
   * `GET /holidays/web?year={year}`: every holiday of the calendar year, in
   * date order.
   */
  async listForYear(year: number): Promise<Holiday[]> {
    const data = await api.get<ApiResponse[]>(BASE, { year });
    return parseWith('holiday list', data, (raw) =>
      (raw as unknown[]).map((item) => parseHoliday(item))
    );
  },

  /** `GET /holidays/web/holiday?holidayId={id}` */
  async get(holidayId: number): Promise<Holiday> {
    const data = await api.get<ApiResponse>(`${BASE}/holiday`, { holidayId });
    return parseWith('holiday', data, parseHoliday);
  },

  /** `POST /holidays/web`: declares a holiday. */
  async create(req: HolidayRequest): Promise<Holiday> {
    const data = await api.post<ApiResponse>(BASE, holidayRequestToJson(req));
    return parseWith('holiday', data, parseHoliday);
  },

  /** `PUT /holidays/web/update?holidayId={id}`: replaces date, name and note. */
  async update(holidayId: number, req: HolidayRequest): Promise<Holiday> {
    const data = await api.put<ApiResponse>(
      `${BASE}/update`,
      holidayRequestToJson(req),
      { holidayId }
    );
    return parseWith('holiday', data, parseHoliday);
  },

  /** `DELETE /holidays/web/delete?holidayId={id}` */
  async remove(holidayId: number): Promise<void> {
    await api.delete(`${BASE}/delete`, { holidayId });
  },

  /** `GET /holidays/web/working-week` */
  async getWorkingWeek(): Promise<WorkingWeek> {
    const data = await api.get<ApiResponse>(`${BASE}/working-week`);
    return parseWith('working week', data, parseWorkingWeek);
  },

  /** `PUT /holidays/web/working-week` */
  async updateWorkingWeek(req: WorkingWeekRequest): Promise<WorkingWeek> {
    const data = await api.put<ApiResponse>(`${BASE}/working-week`, {
      workingDays: req.workingDays,
    });
    return parseWith('working week', data, parseWorkingWeek);
  },
};
