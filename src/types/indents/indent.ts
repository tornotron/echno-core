/**
 * @module indent
 *
 * Domain type and parser for an indent (material requisition) — a
 * project-scoped request for materials, carrying one or more
 * {@link IndentItem} lines. The parser normalises the backend's wire
 * format into the canonical {@link Indent} shape.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';
import type { IndentStatus } from './enums';
import type { IndentItem } from './indent-item';
import { parseIndentItem } from './indent-item';

const IndentResponseSchema = z.object({
  id: opaque,
  indentNumber: nullableString,
  createdAt: backendDate,
  createdBy: z
    .object({
      id: opaque,
      employeeName: nullableString,
    })
    .nullish(),
  status: nullableString,
  expectedOn: backendDate,
  remarks: nullableString,
  projectId: optionalNumericId,
  projectName: nullableString,
  items: z.array(z.unknown()).nullish(),
});

/**
 * A material requisition raised against a project. Carries denormalised
 * display fields (`projectName`, `createdBy.name`) so listings render
 * without joining each related entity.
 */
export interface Indent {
  /** Surrogate primary key. */
  id: number;

  /** Human-readable indent number assigned at creation. */
  indentNumber: string;

  /** ISO 8601 timestamp the indent was created. */
  createdAt: string;

  /**
   * Employee who created the indent. The backend returns the display
   * name under `createdBy.employeeName`; the parser maps it to `name`.
   */
  createdBy: { id: number; name: string };

  /** Lifecycle state — see {@link IndentStatus}. */
  status: IndentStatus;

  /** ISO 8601 date the materials are expected on site. */
  expectedOn?: string;

  /** Free-form notes attached to the indent. */
  remarks?: string;

  /** Surrogate ID of the project the indent is raised against. */
  projectId?: number;

  /** Project display name (denormalised from `projectId`). */
  projectName?: string;

  /** Line items requested by this indent. */
  items: IndentItem[];
}

/**
 * Parses a raw indent payload into a typed {@link Indent}.
 *
 * Maps `createdBy.employeeName` (backend) onto `createdBy.name` (domain).
 * Optional fields fall back to `undefined`; an absent or non-array
 * `items` resolves to `[]`.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link Indent}.
 * @throws {TypeError} When `id` or `createdBy.id` is missing or non-positive
 *   (propagated from {@link parsePositiveInt}).
 */
export function parseIndent(json: unknown): Indent {
  const raw = IndentResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseIndent.id'),
    indentNumber: raw.indentNumber ?? '',
    createdAt: raw.createdAt ?? '',
    createdBy: {
      id: parsePositiveInt(raw.createdBy?.id, 'parseIndent.createdBy.id'),
      name: raw.createdBy?.employeeName ?? '',
    },
    status: raw.status as IndentStatus,
    expectedOn: raw.expectedOn ?? undefined,
    remarks: raw.remarks ?? undefined,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    items: Array.isArray(raw.items)
      ? raw.items.map((item) => parseIndentItem(item))
      : [],
  };
}
