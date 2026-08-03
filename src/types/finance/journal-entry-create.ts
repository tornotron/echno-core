/**
 * @module types/finance/journal-entry-create
 *
 * The {@link PostJournalRequest} payload, its {@link JournalLineRequest} lines,
 * the {@link ReverseJournalRequest} payload, and serializers for posting and
 * reversing journal entries.
 *
 * NOTE: the backend's OpenAPI labels the journal line schema `LineRequest`,
 * which collides (springdoc name clash) with the invoice line DTO of the same
 * simple name. The **actual** journal line is `{ accountId, debit, credit,
 * narration }` (confirmed against the live spec + backend `finance.md`), with
 * exactly one of `debit`/`credit` positive per line and total debits == total
 * credits across the entry.
 */

/** One debit or credit posting on a journal-post request. */
export interface JournalLineRequest {
  /** Ledger account to post to. Required. Must be an active, postable (leaf) account. */
  accountId: string;
  /** Debit amount (set 0 when this is a credit line). Required. */
  debit: number;
  /** Credit amount (set 0 when this is a debit line). Required. */
  credit: number;
  /** Optional narration (max 500). */
  narration?: string;
}

/** Fields for posting a manual journal entry. */
export interface PostJournalRequest {
  /** Entry date (`YYYY-MM-DD`). Required; must not be in the future. */
  entryDate: string;
  /** Description (max 500). */
  description?: string;
  /** Optional external reference (max 100). */
  reference?: string;
  /** Debit/credit lines. At least 2 required; must balance. */
  lines: JournalLineRequest[];
}

/** Fields for reversing a posted journal entry. */
export interface ReverseJournalRequest {
  /** Optional reason for the reversal (max 500). */
  reason?: string;
}

/**
 * Serializes a {@link PostJournalRequest} into the backend request body.
 * Each line always emits `accountId`, `debit`, and `credit`; `narration` only
 * when set.
 *
 * @param dto - The post request to serialize.
 * @returns A plain object matching `PostJournalRequest`.
 */
export function postJournalToJson(
  dto: PostJournalRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    entryDate: dto.entryDate,
    lines: dto.lines.map((line) => {
      const lineJson: Record<string, unknown> = {
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
      };
      if (line.narration !== undefined) lineJson.narration = line.narration;
      return lineJson;
    }),
  };
  if (dto.description !== undefined) json.description = dto.description;
  if (dto.reference !== undefined) json.reference = dto.reference;
  return json;
}
