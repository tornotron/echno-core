/**
 * @module types/finance/journal-entry
 *
 * The {@link JournalEntry} entity and its {@link JournalEntryLine} debit/credit
 * postings (backend `JournalEntryDto` / `JournalEntryLineDto`), plus parsers.
 * Write payloads live in `journal-entry-create.ts` (re-exported).
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  money,
  nullableNumber,
  nullableString,
  opaque,
} from '../../lib/validation/backend-schema';
import { JournalEntryStatus, parseJournalEntryStatus } from './finance-enums';

const JournalEntryLineSchema = z.object({
  id: z.string().nullish(),
  accountId: nullableString,
  accountCode: nullableString,
  accountName: nullableString,
  debit: money,
  credit: money,
  narration: nullableString,
  lineOrder: nullableNumber,
});

const JournalEntrySchema = z.object({
  id: z.string().nullish(),
  entryNumber: nullableString,
  entryDate: backendDate,
  description: nullableString,
  reference: nullableString,
  status: opaque,
  reversedByEntryId: nullableString,
  reversesEntryId: nullableString,
  sourceType: nullableString,
  sourceId: nullableString,
  lines: z.array(z.unknown()).nullish(),
  createdAt: backendDate,
  createdBy: nullableString,
});

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
export function parseJournalEntryLine(json: unknown): JournalEntryLine {
  const raw = JournalEntryLineSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseJournalEntryLine.id'),
    accountId: raw.accountId ?? undefined,
    accountCode: raw.accountCode ?? undefined,
    accountName: raw.accountName ?? undefined,
    debit: raw.debit ?? 0,
    credit: raw.credit ?? 0,
    narration: raw.narration ?? undefined,
    lineOrder: raw.lineOrder ?? undefined,
  };
}

/**
 * Parses a raw journal-entry payload into a typed {@link JournalEntry}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `JournalEntry`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseJournalEntry(json: unknown): JournalEntry {
  const raw = JournalEntrySchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseJournalEntry.id'),
    entryNumber: raw.entryNumber ?? '',
    entryDate: raw.entryDate ?? undefined,
    description: raw.description ?? undefined,
    reference: raw.reference ?? undefined,
    status: parseJournalEntryStatus(raw.status),
    reversedByEntryId: raw.reversedByEntryId ?? undefined,
    reversesEntryId: raw.reversesEntryId ?? undefined,
    sourceType: raw.sourceType ?? undefined,
    sourceId: raw.sourceId ?? undefined,
    lines: Array.isArray(raw.lines)
      ? raw.lines.map((line) => parseJournalEntryLine(line))
      : [],
    createdAt: raw.createdAt ?? undefined,
    createdBy: raw.createdBy ?? undefined,
  };
}

export {
  type PostJournalRequest,
  type JournalLineRequest,
  postJournalToJson,
  type ReverseJournalRequest,
} from './journal-entry-create';
