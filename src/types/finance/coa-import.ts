/**
 * @module types/finance/coa-import
 *
 * The {@link CoaImportSummary} result of a chart-of-accounts CSV import
 * (`POST /finance/accounts/web/import`, backend `CoaImportSummaryDto`) and its
 * parser {@link parseCoaImportSummary}. The summary reports how many accounts
 * were created and updated, plus a per-row list of error messages for the rows
 * the backend skipped.
 */

import { z } from 'zod';

const CoaImportSummaryResponseSchema = z.object({
  created: z.number().nullish(),
  updated: z.number().nullish(),
  errors: z.array(z.string()).nullish(),
});

/** Outcome of a chart-of-accounts CSV import. */
export interface CoaImportSummary {
  /** Number of ledger accounts created. */
  created: number;
  /** Number of existing ledger accounts updated. */
  updated: number;
  /** Per-row error messages for the rows that were skipped. */
  errors: string[];
}

/**
 * Parses a raw import-summary payload into a typed {@link CoaImportSummary}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `CoaImportSummary` (counts default to `0`, `errors` to `[]`).
 */
export function parseCoaImportSummary(json: unknown): CoaImportSummary {
  const raw = CoaImportSummaryResponseSchema.parse(json);
  return {
    created: raw.created ?? 0,
    updated: raw.updated ?? 0,
    errors: raw.errors ?? [],
  };
}
