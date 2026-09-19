/**
 * @module toolbox-talks
 *
 * Domain types for the Toolbox Talks module (`MODULE_TOOLBOX_TALKS`): the
 * talk as the backend publishes it, its request shapes, and the parsers
 * that turn a raw payload into the typed entity.
 *
 * A toolbox talk is the short safety briefing a supervisor gives a crew
 * before work starts. One aggregate: the talk with its topic, project,
 * optional spatial node, conductor, date and time, notes and attendees.
 * It is drafted, edited while a draft, then recorded once; a recorded talk
 * no longer changes. Photo evidence goes through the platform's presigned
 * upload path keyed on the talk's UUID (see the attachment types).
 *
 * The parsers are non-strict: a field the backend adds later never breaks
 * this client.
 */

import { z } from 'zod';
import {
  backendDate,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';

/** Lifecycle of a talk. A draft becomes recorded exactly once. */
export enum ToolboxTalkStatus {
  DRAFT = 'DRAFT',
  RECORDED = 'RECORDED',
}

/** An employee who attended a talk. */
export interface ToolboxTalkAttendee {
  employeeId: number;
}

/** A toolbox talk as published by the backend. */
export interface ToolboxTalk {
  /** UUID of the talk. */
  id: string;
  /** Owning project. */
  projectId: number;
  /** Floor or zone the talk was held at, when one was chosen. */
  spatialNodeId?: string;
  /** What the talk was about. */
  topic: string;
  /** ISO date (`YYYY-MM-DD`) the talk was held. */
  talkDate: string;
  /** Local time (`HH:mm:ss`) the talk was held, when recorded. */
  talkTime?: string;
  /** Employee who gave the talk. */
  conductorEmployeeId: number;
  /** Free-text notes, empty when the backend sends none. */
  notes: string;
  status: ToolboxTalkStatus;
  /** Employees who attended, empty for a fresh draft. */
  attendees: ToolboxTalkAttendee[];
  /** ISO timestamp the talk was recorded, absent while a draft. */
  recordedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Body of `POST /toolbox-talks/web`: drafts a talk. */
export interface CreateToolboxTalkRequest {
  projectId: number;
  topic: string;
  /** ISO date (`YYYY-MM-DD`), no more than a day ahead. */
  talkDate: string;
  conductorEmployeeId: number;
  spatialNodeId?: string;
  /** `HH:mm:ss`. */
  talkTime?: string;
  notes?: string;
  attendeeEmployeeIds?: number[];
}

/**
 * Body of `PUT /toolbox-talks/web/{id}`: changes a draft. The backend
 * requires the three identifying fields on every update, so this is a
 * full replacement of the editable columns, not a patch.
 */
export interface UpdateToolboxTalkRequest {
  topic: string;
  talkDate: string;
  conductorEmployeeId: number;
  spatialNodeId?: string;
  talkTime?: string;
  notes?: string;
}

/** Body of `POST /toolbox-talks/web/{id}/attendees`. */
export interface ToolboxTalkAttendeesRequest {
  employeeIds: number[];
}

/** Query parameters of `GET /toolbox-talks/web`. */
export interface ToolboxTalkListParams {
  projectId?: number;
  /** Inclusive ISO date lower bound. */
  from?: string;
  /** Inclusive ISO date upper bound. */
  to?: string;
  status?: ToolboxTalkStatus;
  /** 0-based page index. */
  pageNo?: number;
  pageSize?: number;
}

/** A page of talks, the backend's own envelope. */
export interface ToolboxTalkPage {
  content: ToolboxTalk[];
  /** 0-based page index. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const employeeId = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+$/).transform(Number),
]);

const ToolboxTalkAttendeeSchema = z.object({
  employeeId,
});

const ToolboxTalkResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  projectId: nullableNumber,
  spatialNodeId: nullableString,
  topic: nullableString,
  talkDate: nullableString,
  talkTime: nullableString,
  conductorEmployeeId: nullableNumber,
  notes: nullableString,
  status: nullableString,
  attendees: z.array(z.unknown()).nullish(),
  recordedAt: backendDate,
  createdAt: backendDate,
  updatedAt: backendDate,
});

const ToolboxTalkPageSchema = z.object({
  content: z.array(z.unknown()).nullish(),
  page: nullableNumber,
  number: nullableNumber,
  size: nullableNumber,
  totalElements: nullableNumber,
  totalPages: nullableNumber,
});

function parseStatus(raw: string | null | undefined): ToolboxTalkStatus {
  return raw === ToolboxTalkStatus.RECORDED
    ? ToolboxTalkStatus.RECORDED
    : ToolboxTalkStatus.DRAFT;
}

/** Parses one attendee row; a malformed row is dropped by the caller. */
export function parseToolboxTalkAttendee(json: unknown): ToolboxTalkAttendee {
  const raw = ToolboxTalkAttendeeSchema.parse(json);
  return { employeeId: raw.employeeId };
}

/**
 * Parses a raw API payload into a typed {@link ToolboxTalk}.
 *
 * Non-strict: unknown keys are stripped rather than rejected. Only `id` is
 * required; every other field defaults when absent. An unknown status
 * reads as a draft, the safer of the two for the UI (it shows the edit
 * controls, and the backend refuses the write if it was wrong).
 *
 * @throws {Error} If `id` is missing.
 */
export function parseToolboxTalk(json: unknown): ToolboxTalk {
  const raw = ToolboxTalkResponseSchema.parse(json);
  const attendees: ToolboxTalkAttendee[] = [];
  for (const item of raw.attendees ?? []) {
    const parsed = ToolboxTalkAttendeeSchema.safeParse(item);
    if (parsed.success) attendees.push({ employeeId: parsed.data.employeeId });
  }
  return {
    id: String(raw.id),
    projectId: raw.projectId ?? 0,
    spatialNodeId: raw.spatialNodeId ?? undefined,
    topic: raw.topic ?? '',
    talkDate: raw.talkDate ?? '',
    talkTime: raw.talkTime ?? undefined,
    conductorEmployeeId: raw.conductorEmployeeId ?? 0,
    notes: raw.notes ?? '',
    status: parseStatus(raw.status),
    attendees,
    recordedAt: raw.recordedAt ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

/**
 * Parses a Spring-style page of talks. Accepts either `page` or `number`
 * for the index, since the backend has published both spellings.
 */
export function parseToolboxTalkPage(json: unknown): ToolboxTalkPage {
  const raw = ToolboxTalkPageSchema.parse(json);
  const content = (raw.content ?? []).map((item) => parseToolboxTalk(item));
  return {
    content,
    page: raw.page ?? raw.number ?? 0,
    size: raw.size ?? content.length,
    totalElements: raw.totalElements ?? content.length,
    totalPages: raw.totalPages ?? (content.length > 0 ? 1 : 0),
  };
}
