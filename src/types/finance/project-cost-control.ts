/**
 * @module types/finance/project-cost-control
 *
 * The {@link ProjectCostControl} report (backend `ProjectCostControlDto`) with
 * its {@link ProjectCostControlLine} rows, plus their parsers. The report
 * compares each cost category's allocated budget against committed and spent
 * amounts for a project, deriving the remaining balance and an over-budget flag.
 *
 * Every value is computed server-side. The `totals` row (and the trailing line
 * whose `costCategoryId` is `null` and `costCategoryName` is `'Total'`) sums the
 * per-category rows.
 */

import { z } from 'zod';
import { money, nullableString } from '../../lib/validation/backend-schema';

const ProjectCostControlLineSchema = z.object({
  costCategoryId: nullableString,
  costCategoryName: nullableString,
  allocated: money,
  committed: money,
  spent: money,
  remaining: money,
  overBudget: z.boolean().nullish(),
});

const ProjectCostControlSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  categories: z.array(z.unknown()).nullish(),
  totals: z.unknown().nullish(),
});

/** A single cost-control row (one cost category, or the total). */
export interface ProjectCostControlLine {
  /** UUID of the cost category; `null` on the total row. */
  costCategoryId: string | null;
  /** Cost-category name; `'Total'` on the total row. */
  costCategoryName: string;
  /** Budget allocated to the category. */
  allocated: number;
  /** Amount committed (e.g. approved but unpaid). */
  committed: number;
  /** Amount spent (settled). */
  spent: number;
  /** Remaining budget (allocated minus committed / spent). */
  remaining: number;
  /** Whether the category is over its allocated budget. */
  overBudget: boolean;
}

/** The project cost-control report: per-category rows plus a totals row. */
export interface ProjectCostControl {
  /** Project the report covers. */
  projectId: number;
  /** Per-cost-category rows. */
  categories: ProjectCostControlLine[];
  /** The aggregate totals row (`costCategoryId: null`, `costCategoryName: 'Total'`). */
  totals: ProjectCostControlLine;
}

/**
 * Parses a raw cost-control-line payload into a typed
 * {@link ProjectCostControlLine}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `ProjectCostControlLine`.
 */
export function parseProjectCostControlLine(
  json: unknown
): ProjectCostControlLine {
  const raw = ProjectCostControlLineSchema.parse(json);
  return {
    costCategoryId: raw.costCategoryId ?? null,
    costCategoryName: raw.costCategoryName ?? '',
    allocated: raw.allocated ?? 0,
    committed: raw.committed ?? 0,
    spent: raw.spent ?? 0,
    remaining: raw.remaining ?? 0,
    overBudget: raw.overBudget ?? false,
  };
}

/**
 * Parses a raw project-cost-control payload into a typed
 * {@link ProjectCostControl}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `ProjectCostControl`.
 */
export function parseProjectCostControl(json: unknown): ProjectCostControl {
  const raw = ProjectCostControlSchema.parse(json);
  return {
    projectId: raw.projectId,
    categories: Array.isArray(raw.categories)
      ? raw.categories.map((line) => parseProjectCostControlLine(line))
      : [],
    totals: parseProjectCostControlLine(raw.totals ?? {}),
  };
}
