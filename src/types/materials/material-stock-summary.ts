/**
 * @module material-stock-summary
 *
 * Domain type and parser for the figures a materials dashboard strip is
 * built from, totalled by the backend over the whole scope.
 *
 * None of these numbers is derivable from a page of materials. `GET
 * /materials/web` serves at most 500 rows, so a client adding up the stock
 * value it holds describes 500 materials however large the catalogue is,
 * and the units it counts are the units those 500 happened to be held in.
 * The backend totals all of it in the database instead, at organization
 * scope or within one project.
 */
import { z } from 'zod';
import { money, optionalNumericId } from '../../lib/validation/backend-schema';

/**
 * A count the backend totalled: a whole number, never negative. Required
 * rather than nullish, so a payload that arrived without one fails the
 * parse instead of reporting an empty catalogue.
 */
const totalledCount = z.coerce.number().int().nonnegative();

/**
 * Shape of the backend `MaterialStockSummaryDto` at the parse boundary.
 * The counts are strict; `totalStockValue` coerces through `money` because
 * the backend serialises the decimal as a number and, on some drivers, as
 * a string.
 */
const MaterialStockSummaryResponseSchema = z.object({
  projectId: optionalNumericId,
  materialCount: totalledCount,
  distinctUnits: totalledCount,
  totalStockValue: money,
  unvaluedHoldingCount: totalledCount,
});

/**
 * The materials figures for one scope, every one of them totalled server
 * side over that whole scope rather than over the rows a client holds.
 */
export interface MaterialStockSummary {
  /**
   * The project these figures were totalled within. Absent when the whole
   * organization was totalled.
   */
  projectId?: number;

  /**
   * How many materials the figures cover. At organization scope this is
   * the catalogue size, so it is also the number that says whether a
   * material list already on hand is complete. At project scope it is how
   * many materials the project carries a balance row for, which is the
   * same set {@link totalStockValue} is summed over.
   */
  materialCount: number;

  /** How many distinct units of measure those materials are held in. */
  distinctUnits: number;

  /**
   * The value of the stock on hand, summed over every balance row in scope
   * at its running weighted-average cost. Zero when nothing is held.
   */
  totalStockValue: number;

  /**
   * How many balance rows hold a quantity the total could not price,
   * because the receipts behind them carried no unit cost. Those rows sit
   * in {@link totalStockValue} at the zero they hold, so a non-zero count
   * means the total understates and says by how many holdings. It is a
   * caveat to show alongside the figure, not an error: zero means every
   * holding in scope is priced and the total is complete.
   */
  unvaluedHoldingCount: number;
}

/**
 * Parses a raw materials stock summary from the backend.
 *
 * `totalStockValue` is required rather than optional. A summary that
 * arrived without it is a payload no value can be reported from, and
 * defaulting it to zero would put "nothing held" on screen for a store
 * that is full.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link MaterialStockSummary}.
 * @throws {z.ZodError} When the payload does not match the expected shape.
 * @throws {TypeError} When the payload carries no stock value.
 */
export function parseMaterialStockSummary(json: unknown): MaterialStockSummary {
  const raw = MaterialStockSummaryResponseSchema.parse(json);
  if (raw.totalStockValue === null || raw.totalStockValue === undefined) {
    throw new TypeError(
      'parseMaterialStockSummary: totalStockValue is required'
    );
  }
  return {
    projectId: raw.projectId ?? undefined,
    materialCount: raw.materialCount,
    distinctUnits: raw.distinctUnits,
    totalStockValue: raw.totalStockValue,
    unvaluedHoldingCount: raw.unvaluedHoldingCount,
  };
}
