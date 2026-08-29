/**
 * @module types/inspection/checklist-template
 *
 * The reusable per-trade checklist (backend `ChecklistTemplateDto` /
 * `ChecklistTemplateRequest` / `StarterChecklistTemplateDto`), served from
 * `/checklist-templates/web`.
 *
 * A template is a flat, ordered list of check points keyed by
 * {@link InspectionTrade}, one per trade per organization, which is why creating
 * a second for the same trade is a 409. It carries a server-managed integer
 * `version` that the backend bumps on every update. There is no version-history
 * entity, so a previous version cannot be fetched back, and there is no stored
 * schema, so a checklist cannot carry branching logic: anything richer than a
 * list is a client-side construction that has to survive being flattened to one.
 *
 * An update replaces the item list wholesale rather than taking a diff, so a
 * save always sends every check point. There is no delete: a template that has
 * stopped being used is deactivated by sending `active: false`.
 *
 * Inspections already created from a template are unaffected by a later edit.
 * They hold their own copy of the criteria, which is why
 * {@link InspectionCheckItem} carries `acceptanceCriterion` and `tolerance` of
 * its own rather than pointing back at the template row.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableBoolean,
  nullableNumber,
  nullableString,
  opaque,
} from '../../lib/validation/backend-schema';
import { InspectionTrade, parseInspectionTrade } from './inspection';

const ChecklistTemplateItemSchema = z.object({
  id: z.string().nullish(),
  category: nullableString,
  checkPoint: nullableString,
  specification: nullableString,
  expectedValue: nullableString,
  acceptanceCriterion: nullableString,
  tolerance: nullableString,
  photosRequired: nullableBoolean,
  priority: nullableString,
  lineOrder: z.coerce.number().nullish(),
});

const ChecklistTemplateSchema = z.object({
  id: z.string().nullish(),
  trade: opaque,
  name: nullableString,
  description: nullableString,
  active: nullableBoolean,
  version: nullableNumber,
  items: z.array(z.unknown()).nullish(),
  createdAt: backendDate,
  updatedAt: backendDate,
});

const StarterChecklistTemplateSchema = z.object({
  id: z.string().nullish(),
  trade: opaque,
  name: nullableString,
  description: nullableString,
  items: z.array(z.unknown()).nullish(),
});

/**
 * One check point in a template.
 *
 * `lineOrder` is assigned server-side from the position of the item in the
 * submitted list, so it is read-only here and is never sent back.
 */
export interface ChecklistTemplateItem {
  /** UUID primary key. */
  id: string;
  /** Grouping heading the check point sits under. */
  category: string;
  /** The check point itself. */
  checkPoint: string;
  /** Reference specification or code clause. */
  specification?: string;
  /** The value the inspector should find. */
  expectedValue?: string;
  /** What makes this check point pass. */
  acceptanceCriterion?: string;
  /** Permitted band around the expected value. */
  tolerance?: string;
  /** Whether photo evidence is required. */
  photosRequired: boolean;
  /** Priority (free text). */
  priority?: string;
  /** Server-assigned position within the template. */
  lineOrder: number;
}

/** An organization's reusable checklist for one trade. */
export interface ChecklistTemplate {
  /** UUID primary key. */
  id: string;
  /**
   * Trade the checklist covers. Fixed at creation; an update may not change it.
   * Optional here only because the parser refuses to invent a value it does not
   * recognize: the backend column is non-null, so a live template always has one.
   */
  trade?: InspectionTrade;
  /** Name of the checklist. */
  name: string;
  /** What the checklist covers and when it is used. */
  description?: string;
  /** Whether new inspections of this trade are created from it. */
  active: boolean;
  /** Server-managed revision counter, bumped on every update. */
  version: number;
  /** The check points, in the order they are carried out. */
  items: ChecklistTemplateItem[];
  /** Creation timestamp (ISO string). */
  createdAt?: string;
  /** Last-update timestamp (ISO string). */
  updatedAt?: string;
}

/**
 * A product-supplied checklist an organization can adopt as its own. Global
 * reference data, identical for every tenant and read-only until adopted;
 * adopting takes a snapshot, so later revisions of the starter do not reach into
 * the copy.
 */
export interface StarterChecklistTemplate {
  /** UUID primary key. */
  id: string;
  /** Trade the starter covers. */
  trade?: InspectionTrade;
  /** Name of the starter checklist. */
  name: string;
  /** What it covers. */
  description?: string;
  /** The check points it would create. */
  items: ChecklistTemplateItem[];
}

/**
 * Parses a raw checklist-template-item payload into a typed
 * {@link ChecklistTemplateItem}.
 *
 * @param json - The untyped JSON object from the backend.
 * @param index - Fallback position, used when the payload carries no
 *   `lineOrder`; pass the item's index within the list.
 * @returns A validated `ChecklistTemplateItem`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseChecklistTemplateItem(
  json: unknown,
  index = 0
): ChecklistTemplateItem {
  const raw = ChecklistTemplateItemSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseChecklistTemplateItem.id'),
    category: raw.category ?? '',
    checkPoint: raw.checkPoint ?? '',
    specification: raw.specification ?? undefined,
    expectedValue: raw.expectedValue ?? undefined,
    acceptanceCriterion: raw.acceptanceCriterion ?? undefined,
    tolerance: raw.tolerance ?? undefined,
    photosRequired: raw.photosRequired ?? false,
    priority: raw.priority ?? undefined,
    lineOrder: raw.lineOrder ?? index,
  };
}

/**
 * Parses a list of raw check points, sorted by `lineOrder`.
 *
 * The sort is not redundant. The order is what the checklist means (it is the
 * order the work is carried out in) and the backend stores it as a column rather
 * than relying on the collection order, so a client that renders the array as it
 * arrives is trusting something the contract does not promise.
 */
function parseItems(raw: unknown): ChecklistTemplateItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => parseChecklistTemplateItem(item, index))
    .sort((a, b) => a.lineOrder - b.lineOrder);
}

/**
 * Parses a raw checklist-template payload into a typed
 * {@link ChecklistTemplate}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `ChecklistTemplate`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseChecklistTemplate(json: unknown): ChecklistTemplate {
  const raw = ChecklistTemplateSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseChecklistTemplate.id'),
    trade: parseInspectionTrade(raw.trade),
    name: raw.name ?? '',
    description: raw.description ?? undefined,
    // Absent means active: the backend column is non-null and defaults to true,
    // so only an explicit `false` deactivates a template.
    active: raw.active ?? true,
    version: raw.version ?? 1,
    items: parseItems(raw.items),
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

/**
 * Parses a raw starter-checklist payload into a typed
 * {@link StarterChecklistTemplate}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `StarterChecklistTemplate`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseStarterChecklistTemplate(
  json: unknown
): StarterChecklistTemplate {
  const raw = StarterChecklistTemplateSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseStarterChecklistTemplate.id'),
    trade: parseInspectionTrade(raw.trade),
    name: raw.name ?? '',
    description: raw.description ?? undefined,
    items: parseItems(raw.items),
  };
}

/**
 * A check point on a create / update template request. The line order is the
 * position in the submitted list and is not accepted from the client.
 */
export interface ChecklistTemplateItemRequest {
  /** Grouping the check point belongs to (max 200). Required. */
  category: string;
  /** What is being checked (max 500). Required. */
  checkPoint: string;
  /** Reference specification or code clause (max 1000). */
  specification?: string;
  /** Value expected per specification (max 200). */
  expectedValue?: string;
  /** What makes this check point pass (max 1000). */
  acceptanceCriterion?: string;
  /** Permitted band around the expected value (max 100). */
  tolerance?: string;
  /** Whether supporting photos are required. Defaults to `false`. */
  photosRequired?: boolean;
  /** Priority (max 20, free text). */
  priority?: string;
}

/**
 * Creates or fully replaces a template. The trade is fixed at creation, so an
 * update sends it unchanged and a different one is rejected with a 400. The
 * version is a server-side counter and is not accepted here.
 */
export interface ChecklistTemplateRequest {
  /** Trade the checklist covers. Required. */
  trade: InspectionTrade;
  /** Name of the checklist (max 200). Required. */
  name: string;
  /** What the checklist covers and when it is used. */
  description?: string;
  /** Whether new inspections of this trade use it. Defaults to `true`. */
  active?: boolean;
  /** The check points. Required and non-empty; replaces the stored list. */
  items: ChecklistTemplateItemRequest[];
}

/**
 * Serializes one {@link ChecklistTemplateItemRequest} into a backend check-point
 * object. `photosRequired` is a primitive `boolean` on the backend record, so it
 * is always emitted; the rest only when set.
 */
function checklistTemplateItemToJson(
  item: ChecklistTemplateItemRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    category: item.category,
    checkPoint: item.checkPoint,
    photosRequired: item.photosRequired ?? false,
  };
  if (item.specification !== undefined) json.specification = item.specification;
  if (item.expectedValue !== undefined) json.expectedValue = item.expectedValue;
  if (item.acceptanceCriterion !== undefined)
    json.acceptanceCriterion = item.acceptanceCriterion;
  if (item.tolerance !== undefined) json.tolerance = item.tolerance;
  if (item.priority !== undefined) json.priority = item.priority;
  return json;
}

/**
 * Serializes a {@link ChecklistTemplateRequest} into the backend request body.
 *
 * @param dto - The create or replace request to serialize.
 * @returns A plain object matching the backend `ChecklistTemplateRequest`.
 */
export function checklistTemplateToJson(
  dto: ChecklistTemplateRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    trade: dto.trade,
    name: dto.name,
    items: dto.items.map((item) => checklistTemplateItemToJson(item)),
  };
  if (dto.description !== undefined) json.description = dto.description;
  if (dto.active !== undefined) json.active = dto.active;
  return json;
}
