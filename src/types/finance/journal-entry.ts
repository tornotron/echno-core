/**
 * @module types/finance/journal-entry
 *
 * The {@link JournalEntry} entity and its {@link JournalEntryLine} debit/credit
 * postings (backend `JournalEntryDto` / `JournalEntryLineDto`), plus parsers.
 * Write payloads live in `journal-entry-create.ts` (re-exported).
 */

import { parseUuid } from '../../lib/utils/parse-id';
import { JournalEntryStatus, parseJournalEntryStatus } from './finance-enums';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A single debit or credit posting against one ledger account. */
export interface JournalEntryLine {
  /** UUID primary key. */
  id: string;
  /** Ledger account posted to. */
  accountId?: string;
  /** Account code (denormalized). */
  accountCode?: string;
  /** Account name (denormalized). */
  accountName?: string;
  /** Debit amount (0 when this is a credit line). */
  debit: number;
  /** Credit amount (0 when this is a debit line). */
  credit: number;
  /** Free-text narration for the line. */
  narration?: string;
  /** Ordering within the entry. */
  lineOrder?: number;
}

/** A double-entry transaction header with its balanced debit/credit lines. */
export interface JournalEntry {
  /** UUID primary key. */
  id: string;
  /** Human-facing entry number (e.g. `JE-2027-000123`). */
  entryNumber: string;
  /** Entry date (`YYYY-MM-DD`). */
  entryDate?: string;
  /** Description. */
  description?: string;
  /** Optional external reference. */
  reference?: string;
  /** Lifecycle status. */
  status: JournalEntryStatus;
  /** Entry that reversed this one (if reversed). */
  reversedByEntryId?: string;
  /** Entry this one reverses (if it is a reversal). */
  reversesEntryId?: string;
  /** Originating document type (`INVOICE` | `PAYMENT` | `MANUAL` | `REVERSAL`). */
  sourceType?: string;
  /** Originating document id (when tagged). */
  sourceId?: string;
  /** Debit/credit lines. */
  lines: JournalEntryLine[];
  /** Creation timestamp. */
  createdAt?: string;
  /** Creator identifier. */
  createdBy?: string;
}

/** Parses a raw journal-line payload into a typed {@link JournalEntryLine}. */
export function parseJournalEntryLine(json: any): JournalEntryLine {
  return {
    id: parseUuid(json.id, 'parseJournalEntryLine.id'),
    accountId: json.accountId ?? undefined,
    accountCode: json.accountCode ?? undefined,
    accountName: json.accountName ?? undefined,
    debit: json.debit ?? 0,
    credit: json.credit ?? 0,
    narration: json.narration ?? undefined,
    lineOrder: json.lineOrder ?? undefined,
  };
}

/**
 * Parses a raw journal-entry payload into a typed {@link JournalEntry}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `JournalEntry`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseJournalEntry(json: any): JournalEntry {
  return {
    id: parseUuid(json.id, 'parseJournalEntry.id'),
    entryNumber: json.entryNumber ?? '',
    entryDate: json.entryDate ?? undefined,
    description: json.description ?? undefined,
    reference: json.reference ?? undefined,
    status: parseJournalEntryStatus(json.status),
    reversedByEntryId: json.reversedByEntryId ?? undefined,
    reversesEntryId: json.reversesEntryId ?? undefined,
    sourceType: json.sourceType ?? undefined,
    sourceId: json.sourceId ?? undefined,
    lines: Array.isArray(json.lines)
      ? json.lines.map((line: any) => parseJournalEntryLine(line))
      : [],
    createdAt: json.createdAt ?? undefined,
    createdBy: json.createdBy ?? undefined,
  };
}

export {
  type PostJournalRequest,
  type JournalLineRequest,
  postJournalToJson,
  type ReverseJournalRequest,
} from './journal-entry-create';
