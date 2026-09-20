/**
 * @module indent-summary
 *
 * An indent as `GET /indents/web/summary` lists it (`IndentSummaryDto`):
 * the indent's own fields, who raised it, and how many lines it has,
 * without the lines themselves. The full {@link Indent} carries every
 * requested item and every item carries a whole material, so a page of
 * indents was reading the material catalogue to render a list of indent
 * numbers. The backend counts the lines, and the lines already on a
 * purchase order, for the whole page in one aggregate.
 */

import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableNumber,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';
import type { IndentStatus } from './enums';

const IndentSummaryResponseSchema = z.object({
  id: opaque,
  indentNumber: nullableString,
  createdAt: backendDate,
  createdById: optionalNumericId,
  createdByName: nullableString,
  projectId: optionalNumericId,
  projectName: nullableString,
  status: nullableString,
  expectedOn: backendDate,
  remarks: nullableString,
  itemCount: nullableNumber,
  convertedItemCount: nullableNumber,
});

/**
 * An indent without its lines.
 *
 * `createdBy` keeps the `{ id, name }` shape {@link Indent} uses, mapped
 * from the flat `createdById` / `createdByName` the summary carries, so a
 * row component reads either shape the same way. In place of `items` it
 * carries `itemCount` and `convertedItemCount`.
 */
export interface IndentSummary {
  /** Surrogate primary key. */
  id: number;
  /** Human-readable indent number assigned at creation. */
  indentNumber: string;
  /** ISO 8601 timestamp the indent was created. */
  createdAt: string;
  /**
   * Employee who raised the indent. `id` is `0` where the raiser is no
   * longer recorded, which the full parser would reject; a list row shows
   * the name and never navigates by the id.
   */
  createdBy: { id: number; name: string };
  /** Lifecycle state. */
  status: IndentStatus;
  /** ISO 8601 date the materials are expected on site. */
  expectedOn?: string;
  /** Free-form notes attached to the indent. */
  remarks?: string;
  /** Surrogate ID of the project the indent is raised against. */
  projectId?: number;
  /** Project display name. */
  projectName?: string;
  /** How many item lines the indent has. */
  itemCount: number;
  /** How many of those lines have already been converted into a purchase order. */
  convertedItemCount: number;
}

/**
 * The Spring `Page` envelope `GET /indents/web/summary` answers with.
 */
export interface IndentSummaryPage {
  /** The indents on this page. */
  content: IndentSummary[];
  /** Total indents across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** Zero-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/**
 * Parses one `IndentSummaryDto` payload into an {@link IndentSummary}.
 * Non-strict: unknown keys are ignored, absent scalars fall back to the
 * defaults `parseIndent` uses, and absent counts read as zero.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `IndentSummary`.
 * @throws {Error} If `id` is not a positive integer.
 */
export function parseIndentSummary(json: unknown): IndentSummary {
  const raw = IndentSummaryResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseIndentSummary.id'),
    indentNumber: raw.indentNumber ?? '',
    createdAt: raw.createdAt ?? '',
    createdBy: {
      id: raw.createdById ?? 0,
      name: raw.createdByName ?? '',
    },
    status: raw.status as IndentStatus,
    expectedOn: raw.expectedOn ?? undefined,
    remarks: raw.remarks ?? undefined,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    itemCount: Number(raw.itemCount ?? 0),
    convertedItemCount: Number(raw.convertedItemCount ?? 0),
  };
}
