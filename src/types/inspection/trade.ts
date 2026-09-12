/**
 * @module types/inspection/trade
 *
 * The inspection ontology as data (backend `OrgTradeDto`, `TradeCatalogueDto`,
 * `OrgElementTypeDto`, `ElementTypeCatalogueDto`; tornotron/echno-backend#769,
 * #777 and #779, spec `docs/specs/2026-09-12-qaqc-ontology-as-data.md`).
 *
 * A trade used to be a fixed enum of sixteen values. It is now a seeded,
 * organization-extensible catalogue: the product ships `trade_catalogue`, every
 * organization gets its own copy in `inspection_trades`, and an admin adds
 * trades of their own without a release. The same pattern gives the element
 * type catalogue that types a spatial node at the `ELEMENT` level.
 *
 * On the wire nothing changed shape. `trade` on an inspection or a template
 * was always the slug string the Java enum put through `@JsonValue`, so the
 * sixteen shipped codes carry the same strings they always did. What widened
 * is the type: {@link InspectionTrade} is now any slug, and the sixteen legacy
 * codes stay exported as named constants for callers that still switch on
 * them. An exhaustive `switch` over the old union needs a default branch.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  nullableBoolean,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';

// ---------------------------------------------------------------------------
// The trade code and the sixteen legacy constants
// ---------------------------------------------------------------------------

/**
 * The sixteen trades that shipped as the `InspectionTrade` enum, keyed by the
 * Java constant name and valued with the wire slug. Kept as named constants so
 * a caller can still write `InspectionTrade.REINFORCEMENT`; new trades come
 * from the organization's list ({@link OrgTrade}) rather than from here.
 *
 * The values are pinned against the backend enum in `trade.test.ts`, the way
 * the wire-values guard pins the enums that remain.
 */
export const InspectionTrade = {
  PRE_CONSTRUCTION_DOCUMENTATION: 'pre-construction-documentation',
  SHUTTERING_FORMWORK: 'shuttering-formwork',
  REINFORCEMENT: 'reinforcement',
  RCC: 'rcc',
  MASONRY: 'masonry',
  PLASTERING: 'plastering',
  WATERPROOFING: 'waterproofing',
  FLOORING: 'flooring',
  FABRICATION: 'fabrication',
  ALUMINIUM_UPVC: 'aluminium-upvc',
  ELECTRICAL_FIXTURES: 'electrical-fixtures',
  PLUMBING_FIXTURES: 'plumbing-fixtures',
  SANITARY_FIXTURES: 'sanitary-fixtures',
  FINISHING: 'finishing',
  DIMENSIONAL_CHECK: 'dimensional-check',
  PROGRESS_CHECK: 'progress-check',
} as const;

/**
 * The slug of an inspection trade: one of the sixteen legacy codes, one of the
 * five added with the catalogue (`tiling`, `painting`, `ceilings`,
 * `doors-windows`, `fire-systems`) or a code the organization defined itself.
 * Lowercase letters, digits and hyphens.
 */
export type InspectionTrade = string;

/** The union of the sixteen legacy slugs, for code that still switches on them. */
export type LegacyInspectionTrade =
  (typeof InspectionTrade)[keyof typeof InspectionTrade];

/** Human-readable label for each of the sixteen legacy trades. */
export const inspectionTradeLabels: Record<LegacyInspectionTrade, string> = {
  [InspectionTrade.PRE_CONSTRUCTION_DOCUMENTATION]:
    'Pre-construction Documentation',
  [InspectionTrade.SHUTTERING_FORMWORK]: 'Shuttering / Formwork',
  [InspectionTrade.REINFORCEMENT]: 'Reinforcement',
  [InspectionTrade.RCC]: 'RCC',
  [InspectionTrade.MASONRY]: 'Masonry',
  [InspectionTrade.PLASTERING]: 'Plastering',
  [InspectionTrade.WATERPROOFING]: 'Waterproofing',
  [InspectionTrade.FLOORING]: 'Flooring',
  [InspectionTrade.FABRICATION]: 'Fabrication',
  [InspectionTrade.ALUMINIUM_UPVC]: 'Aluminium / uPVC',
  [InspectionTrade.ELECTRICAL_FIXTURES]: 'Electrical Fixtures',
  [InspectionTrade.PLUMBING_FIXTURES]: 'Plumbing Fixtures',
  [InspectionTrade.SANITARY_FIXTURES]: 'Sanitary Fixtures',
  [InspectionTrade.FINISHING]: 'Finishing',
  [InspectionTrade.DIMENSIONAL_CHECK]: 'Dimensional Check',
  [InspectionTrade.PROGRESS_CHECK]: 'Progress Check',
};

/**
 * The legacy trades in the order site work reaches them. A fallback for a
 * picker that has no organization list to read; a live picker should render
 * {@link OrgTrade} rows grouped by `groupCode` instead.
 */
export const inspectionTradeOrder: readonly LegacyInspectionTrade[] = [
  InspectionTrade.PRE_CONSTRUCTION_DOCUMENTATION,
  InspectionTrade.SHUTTERING_FORMWORK,
  InspectionTrade.REINFORCEMENT,
  InspectionTrade.RCC,
  InspectionTrade.MASONRY,
  InspectionTrade.PLASTERING,
  InspectionTrade.WATERPROOFING,
  InspectionTrade.FLOORING,
  InspectionTrade.FABRICATION,
  InspectionTrade.ALUMINIUM_UPVC,
  InspectionTrade.ELECTRICAL_FIXTURES,
  InspectionTrade.PLUMBING_FIXTURES,
  InspectionTrade.SANITARY_FIXTURES,
  InspectionTrade.FINISHING,
  InspectionTrade.DIMENSIONAL_CHECK,
  InspectionTrade.PROGRESS_CHECK,
];

/** Whether a slug is one of the sixteen legacy trades. */
export function isLegacyInspectionTrade(
  value: unknown
): value is LegacyInspectionTrade {
  return (
    typeof value === 'string' &&
    (Object.values(InspectionTrade) as string[]).includes(value)
  );
}

const TRADE_CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Narrows an untyped backend string to an {@link InspectionTrade} slug, or
 * `undefined` when the value is absent or not a slug. The trade is genuinely
 * optional: safety and compliance inspections leave it unset, so a missing
 * value is preserved rather than defaulted. Any well-formed slug is accepted,
 * since an organization may have defined it.
 */
export function parseInspectionTrade(raw: unknown): InspectionTrade | undefined {
  return typeof raw === 'string' && TRADE_CODE.test(raw) ? raw : undefined;
}

/**
 * Label for a trade slug: the row's own name when the caller has it, the
 * legacy label for one of the sixteen, and otherwise the slug title-cased
 * (`precast-erection` becomes `Precast Erection`).
 */
export function inspectionTradeLabel(
  code: InspectionTrade | undefined,
  name?: string | null
): string {
  if (name) return name;
  if (code === undefined) return '';
  if (isLegacyInspectionTrade(code)) return inspectionTradeLabels[code];
  return code
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Catalogue rows
// ---------------------------------------------------------------------------

/**
 * One row of a product-shipped catalogue (trade or element type). Read only;
 * organizations work against their own copy.
 */
export interface CatalogueEntry {
  /** Stable slug. */
  code: string;
  name: string;
  /** Group heading the row is listed under. */
  groupCode: string;
  description?: string;
  sortOrder: number;
  active: boolean;
}

/** One trade of the product-shipped trade catalogue. */
export type TradeCatalogueEntry = CatalogueEntry;

/** One element type of the product-shipped element type catalogue. */
export type ElementTypeCatalogueEntry = CatalogueEntry;

/**
 * A row as the organization has it: a catalogue copy (`catalogueCode` set) or
 * an org-defined row (`catalogueCode` unset). The code is fixed once created;
 * everything else may change; a row is deactivated, never deleted.
 */
export interface OrgCatalogueRow extends CatalogueEntry {
  /** UUID primary key of the organization's row. */
  id: string;
  /** Catalogue code the row was copied from; unset for an org-defined row. */
  catalogueCode?: string;
}

/**
 * An inspection trade as the organization has it. `code` is the string an
 * inspection or template carries as `trade`; `id` is what it carries as
 * `tradeId`.
 */
export type OrgTrade = OrgCatalogueRow;

/**
 * An element type as the organization has it. `code` is the value a spatial
 * node's `elementType` carries.
 */
export type OrgElementType = OrgCatalogueRow;

const CatalogueEntrySchema = z.object({
  code: nullableString,
  name: nullableString,
  groupCode: nullableString,
  description: nullableString,
  sortOrder: nullableNumber,
  active: nullableBoolean,
});

const OrgCatalogueRowSchema = CatalogueEntrySchema.extend({
  id: z.string().nullish(),
  catalogueCode: nullableString,
});

function toCatalogueEntry(
  raw: z.infer<typeof CatalogueEntrySchema>
): CatalogueEntry {
  return {
    code: raw.code ?? '',
    name: raw.name ?? '',
    groupCode: raw.groupCode ?? '',
    description: raw.description ?? undefined,
    sortOrder: raw.sortOrder ?? 0,
    // Absent means active: the column is non-null and defaults to true.
    active: raw.active ?? true,
  };
}

/** Parses a raw `TradeCatalogueDto` into a typed {@link TradeCatalogueEntry}. */
export function parseTradeCatalogueEntry(json: unknown): TradeCatalogueEntry {
  return toCatalogueEntry(CatalogueEntrySchema.parse(json));
}

/**
 * Parses a raw `ElementTypeCatalogueDto` into a typed
 * {@link ElementTypeCatalogueEntry}.
 */
export function parseElementTypeCatalogueEntry(
  json: unknown
): ElementTypeCatalogueEntry {
  return toCatalogueEntry(CatalogueEntrySchema.parse(json));
}

function toOrgRow(
  raw: z.infer<typeof OrgCatalogueRowSchema>,
  where: string
): OrgCatalogueRow {
  return {
    id: parseUuid(raw.id, where),
    ...toCatalogueEntry(raw),
    catalogueCode: raw.catalogueCode ?? undefined,
  };
}

/**
 * Parses a raw `OrgTradeDto` into a typed {@link OrgTrade}.
 *
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseOrgTrade(json: unknown): OrgTrade {
  return toOrgRow(OrgCatalogueRowSchema.parse(json), 'parseOrgTrade.id');
}

/**
 * Parses a raw `OrgElementTypeDto` into a typed {@link OrgElementType}.
 *
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseOrgElementType(json: unknown): OrgElementType {
  return toOrgRow(OrgCatalogueRowSchema.parse(json), 'parseOrgElementType.id');
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Payload to define an organization's own trade or element type. */
export interface CreateCatalogueRowRequest {
  /** Slug: lowercase letters, digits and hyphens. Unique within the organization. */
  code: string;
  /** Display name (max 200). */
  name: string;
  /** Group heading (max 50). Any string; see the seeded groups on the catalogue. */
  groupCode: string;
  description?: string;
  /** Position in pickers. Defaults to after every seeded row. */
  sortOrder?: number;
}

/** Payload to define an organization's own trade. */
export type CreateTradeRequest = CreateCatalogueRowRequest;

/** Payload to define an organization's own element type. */
export type CreateElementTypeRequest = CreateCatalogueRowRequest;

/**
 * Fields of a trade or element type that may change after creation. Omitted
 * fields are left as they are; the code never changes.
 */
export interface UpdateCatalogueRowRequest {
  name?: string;
  groupCode?: string;
  description?: string;
  sortOrder?: number;
  /** `false` retires the row from pickers without touching the rows that reference it. */
  active?: boolean;
}

/** Fields of a trade that may change after creation. */
export type UpdateTradeRequest = UpdateCatalogueRowRequest;

/** Fields of an element type that may change after creation. */
export type UpdateElementTypeRequest = UpdateCatalogueRowRequest;

/** Serializes a {@link CreateCatalogueRowRequest} into the backend request body. */
export function createCatalogueRowToJson(
  dto: CreateCatalogueRowRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    code: dto.code,
    name: dto.name,
    groupCode: dto.groupCode,
  };
  if (dto.description !== undefined) json.description = dto.description;
  if (dto.sortOrder !== undefined) json.sortOrder = dto.sortOrder;
  return json;
}

/** Serializes an {@link UpdateCatalogueRowRequest} into the backend request body. */
export function updateCatalogueRowToJson(
  dto: UpdateCatalogueRowRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (dto.name !== undefined) json.name = dto.name;
  if (dto.groupCode !== undefined) json.groupCode = dto.groupCode;
  if (dto.description !== undefined) json.description = dto.description;
  if (dto.sortOrder !== undefined) json.sortOrder = dto.sortOrder;
  if (dto.active !== undefined) json.active = dto.active;
  return json;
}

/** Serializes a {@link CreateTradeRequest}. */
export const createTradeToJson = createCatalogueRowToJson;
/** Serializes an {@link UpdateTradeRequest}. */
export const updateTradeToJson = updateCatalogueRowToJson;
/** Serializes a {@link CreateElementTypeRequest}. */
export const createElementTypeToJson = createCatalogueRowToJson;
/** Serializes an {@link UpdateElementTypeRequest}. */
export const updateElementTypeToJson = updateCatalogueRowToJson;

// ---------------------------------------------------------------------------
// Grouping for pickers
// ---------------------------------------------------------------------------

/** Rows of one group, in `sortOrder` then name order, for a grouped picker. */
export interface CatalogueGroup<T extends CatalogueEntry> {
  groupCode: string;
  rows: T[];
}

/** Human-readable heading for the seeded group codes; other codes are title-cased. */
export function catalogueGroupLabel(groupCode: string): string {
  switch (groupCode) {
    case 'mep':
      return 'MEP';
    case 'rcc':
      return 'RCC';
    default:
      return inspectionTradeLabel(groupCode);
  }
}

/**
 * Groups rows by `groupCode`, keeping the first-seen group order after sorting
 * every row by `sortOrder` then name. Inactive rows are dropped unless
 * `includeInactive` is set.
 */
export function groupCatalogueRows<T extends CatalogueEntry>(
  rows: readonly T[],
  includeInactive = false
): CatalogueGroup<T>[] {
  const sorted = rows
    .filter((row) => includeInactive || row.active)
    .slice()
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
    );
  const groups = new Map<string, T[]>();
  for (const row of sorted) {
    const bucket = groups.get(row.groupCode);
    if (bucket) bucket.push(row);
    else groups.set(row.groupCode, [row]);
  }
  return Array.from(groups, ([groupCode, rows]) => ({ groupCode, rows }));
}

// ---------------------------------------------------------------------------
// Template applicability
// ---------------------------------------------------------------------------

/**
 * Whether a template's applicability admits an element type and a project
 * type. An unset list admits everything; the check is a suggestion filter,
 * any template may still be used on any element.
 */
export function templateApplies(
  template: {
    applicableElementTypes?: readonly string[];
    applicableProjectTypes?: readonly string[];
  },
  elementType?: string,
  projectType?: string
): boolean {
  const elements = template.applicableElementTypes;
  if (
    elementType !== undefined &&
    elements !== undefined &&
    elements.length > 0 &&
    !elements.includes(elementType)
  ) {
    return false;
  }
  const projects = template.applicableProjectTypes;
  if (
    projectType !== undefined &&
    projects !== undefined &&
    projects.length > 0 &&
    !projects.includes(projectType)
  ) {
    return false;
  }
  return true;
}
