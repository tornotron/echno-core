/**
 * @module spatial
 *
 * A project's site structure: the `Building > Floor > Zone > Element` tree
 * that inspections, defects and check items point at by stable id
 * (spec `echno-backend/docs/specs/2026-09-12-qaqc-spatial-hierarchy.md`).
 *
 * Two response shapes come off the wire. {@link SpatialTreeNode} is what
 * `GET /project/{projectId}/spatial` returns: every node with its children
 * nested. {@link SpatialNode} is the flat single-node shape every write
 * returns, carrying its own breadcrumb (`spatialPath`) so a caller can render
 * the path with no second call.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';

/** The four levels of the tree, top down. */
export type SpatialLevel = 'BUILDING' | 'FLOOR' | 'ZONE' | 'ELEMENT';

/** Every level in tree order, for cascading pickers and level arithmetic. */
export const spatialLevels: readonly SpatialLevel[] = [
  'BUILDING',
  'FLOOR',
  'ZONE',
  'ELEMENT',
];

/** Display labels for each level. */
export const spatialLevelLabels: Record<SpatialLevel, string> = {
  BUILDING: 'Building',
  FLOOR: 'Floor',
  ZONE: 'Zone',
  ELEMENT: 'Element',
};

/**
 * The level directly below `level`, or `undefined` for an element.
 */
export function childSpatialLevel(level: SpatialLevel): SpatialLevel | undefined {
  return spatialLevels[spatialLevels.indexOf(level) + 1];
}

/** One ancestor on the way from the building down to a node. */
export interface SpatialPathSegment {
  id: string;
  level: SpatialLevel;
  code: string;
  name: string;
}

/** Fields every node carries, whichever shape it arrives in. */
export interface SpatialNodeBase {
  id: string;
  level: SpatialLevel;
  /** Short label, unique among siblings. */
  code: string;
  name: string;
  /** Parent node id; absent on a building. */
  parentId?: string;
  sortOrder: number;
  /** Floors only: negative for basements, 0 for ground. */
  levelIndex?: number;
  /** Elements only: free slug such as `column`. */
  elementType?: string;
  /** IFC GlobalId, unique within the project. */
  bimElementGuid?: string;
  /** Drawing or grid reference. */
  externalRef?: string;
  /** Set when the node (and its subtree) is archived. */
  archivedAt?: string;
}

/** A node as the tree endpoint returns it, children nested. */
export interface SpatialTreeNode extends SpatialNodeBase {
  children: SpatialTreeNode[];
}

/** A single node with the path from its building down to itself. */
export interface SpatialNode extends SpatialNodeBase {
  projectId?: number;
  /** 0 for a building, 3 for an element. */
  depth: number;
  /** Ordered ancestors from the building down to and including this node. */
  spatialPath: SpatialPathSegment[];
}

/**
 * Parses a level, defaulting to `'ELEMENT'` for an unknown value so a row with
 * a level this client does not know still lands at the bottom of the tree
 * rather than failing the whole parse.
 */
export function parseSpatialLevel(raw: unknown): SpatialLevel {
  return typeof raw === 'string' &&
    (spatialLevels as readonly string[]).includes(raw)
    ? (raw as SpatialLevel)
    : 'ELEMENT';
}

const SpatialPathSegmentSchema = z.object({
  id: z.string().nullish(),
  level: nullableString,
  code: nullableString,
  name: nullableString,
});

const SpatialNodeBaseSchema = z.object({
  id: z.string().nullish(),
  level: nullableString,
  code: nullableString,
  name: nullableString,
  parentId: nullableString,
  sortOrder: nullableNumber,
  levelIndex: nullableNumber,
  elementType: nullableString,
  bimElementGuid: nullableString,
  externalRef: nullableString,
  archivedAt: backendDate,
});

type SpatialNodeBaseRaw = z.infer<typeof SpatialNodeBaseSchema>;

interface SpatialTreeNodeRaw extends SpatialNodeBaseRaw {
  children?: SpatialTreeNodeRaw[] | null;
}

const SpatialTreeNodeSchema: z.ZodType<SpatialTreeNodeRaw> =
  SpatialNodeBaseSchema.extend({
    children: z.lazy(() => z.array(SpatialTreeNodeSchema).nullish()),
  });

const SpatialNodeSchema = SpatialNodeBaseSchema.extend({
  projectId: nullableNumber,
  depth: nullableNumber,
  spatialPath: z.array(SpatialPathSegmentSchema).nullish(),
});

function parseBase(raw: SpatialNodeBaseRaw, context: string): SpatialNodeBase {
  return {
    id: parseUuid(raw.id, context),
    level: parseSpatialLevel(raw.level),
    code: raw.code ?? '',
    name: raw.name ?? raw.code ?? '',
    parentId: raw.parentId ?? undefined,
    sortOrder: raw.sortOrder ?? 0,
    levelIndex: raw.levelIndex ?? undefined,
    elementType: raw.elementType ?? undefined,
    bimElementGuid: raw.bimElementGuid ?? undefined,
    externalRef: raw.externalRef ?? undefined,
    archivedAt: raw.archivedAt ?? undefined,
  };
}

/** Parses one breadcrumb segment. Non-strict: extra keys are dropped. */
export function parseSpatialPathSegment(json: unknown): SpatialPathSegment {
  const raw = SpatialPathSegmentSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseSpatialPathSegment.id'),
    level: parseSpatialLevel(raw.level),
    code: raw.code ?? '',
    name: raw.name ?? raw.code ?? '',
  };
}

/**
 * Parses a node of the nested tree response. Non-strict: unknown keys are
 * dropped, absent children read as none.
 *
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseSpatialTreeNode(json: unknown): SpatialTreeNode {
  const raw = SpatialTreeNodeSchema.parse(json);
  return {
    ...parseBase(raw, 'parseSpatialTreeNode.id'),
    children: (raw.children ?? []).map((child: SpatialTreeNodeRaw) =>
      parseSpatialTreeNode(child)
    ),
  };
}

/**
 * Parses the flat single-node response every write returns.
 *
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseSpatialNode(json: unknown): SpatialNode {
  const raw = SpatialNodeSchema.parse(json);
  return {
    ...parseBase(raw, 'parseSpatialNode.id'),
    projectId: raw.projectId ?? undefined,
    depth: raw.depth ?? 0,
    spatialPath: (raw.spatialPath ?? []).map((segment) =>
      parseSpatialPathSegment(segment)
    ),
  };
}

/**
 * Renders a breadcrumb such as `B1 / L03 / Z1 / C4` from a path. Uses the
 * code of each segment; pass `'name'` to use names instead.
 */
export function formatSpatialPath(
  path: readonly SpatialPathSegment[],
  field: 'code' | 'name' = 'code',
  separator = ' / '
): string {
  return path.map((segment) => segment[field] || segment.code).join(separator);
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Adds a node under a parent of the level above it; a building has no parent. */
export interface CreateSpatialNodeRequest {
  level: SpatialLevel;
  /** Short label, unique among siblings (max 50). Required. */
  code: string;
  /** Display name (max 200). Required. */
  name: string;
  /** Parent node id. Omit for a building. */
  parentId?: string;
  sortOrder?: number;
  /** Floors only. */
  levelIndex?: number;
  /** Elements only (max 50). */
  elementType?: string;
  /** IFC GlobalId (max 100). */
  bimElementGuid?: string;
  /** Drawing or grid reference (max 200). */
  externalRef?: string;
}

/** Partial update; an omitted field is left as it is. */
export interface UpdateSpatialNodeRequest {
  code?: string;
  name?: string;
  sortOrder?: number;
  levelIndex?: number;
  elementType?: string;
  bimElementGuid?: string;
  externalRef?: string;
}

/** Re-parents a node under an active node of the level above. */
export interface MoveSpatialNodeRequest {
  parentId: string;
}

/**
 * One spreadsheet row of the site structure: codes from the building down.
 * A code doubles as the name on first creation; nodes already on the code
 * path are skipped, so the same rows can be posted again.
 */
export interface SpatialImportRow {
  building: string;
  floor?: string;
  /** Omitted with an element present: the floor's default zone is used. */
  zone?: string;
  element?: string;
  /** Applied when the floor is created. */
  levelIndex?: number;
  /** Applied when the element is created. */
  elementType?: string;
}

/** Bulk import, one row per leaf (1 to 5000 rows). */
export interface SpatialImportRequest {
  rows: SpatialImportRow[];
}

/** How many nodes the import created and how many already existed. */
export interface SpatialImportResult {
  created: number;
  skipped: number;
}

const SpatialImportResultSchema = z.object({
  created: nullableNumber,
  skipped: nullableNumber,
});

/** Parses the import result. Non-strict; absent counts read as zero. */
export function parseSpatialImportResult(json: unknown): SpatialImportResult {
  const raw = SpatialImportResultSchema.parse(json);
  return { created: raw.created ?? 0, skipped: raw.skipped ?? 0 };
}

/** Serializes a {@link CreateSpatialNodeRequest} into the backend body. */
export function createSpatialNodeToJson(
  dto: CreateSpatialNodeRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    level: dto.level,
    code: dto.code,
    name: dto.name,
  };
  if (dto.parentId !== undefined) json.parentId = dto.parentId;
  if (dto.sortOrder !== undefined) json.sortOrder = dto.sortOrder;
  if (dto.levelIndex !== undefined) json.levelIndex = dto.levelIndex;
  if (dto.elementType !== undefined) json.elementType = dto.elementType;
  if (dto.bimElementGuid !== undefined) json.bimElementGuid = dto.bimElementGuid;
  if (dto.externalRef !== undefined) json.externalRef = dto.externalRef;
  return json;
}

/** Serializes an {@link UpdateSpatialNodeRequest} into the backend body. */
export function updateSpatialNodeToJson(
  dto: UpdateSpatialNodeRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (dto.code !== undefined) json.code = dto.code;
  if (dto.name !== undefined) json.name = dto.name;
  if (dto.sortOrder !== undefined) json.sortOrder = dto.sortOrder;
  if (dto.levelIndex !== undefined) json.levelIndex = dto.levelIndex;
  if (dto.elementType !== undefined) json.elementType = dto.elementType;
  if (dto.bimElementGuid !== undefined) json.bimElementGuid = dto.bimElementGuid;
  if (dto.externalRef !== undefined) json.externalRef = dto.externalRef;
  return json;
}

/** Serializes a {@link MoveSpatialNodeRequest} into the backend body. */
export function moveSpatialNodeToJson(
  dto: MoveSpatialNodeRequest
): Record<string, unknown> {
  return { parentId: dto.parentId };
}

/** Serializes one import row, dropping undefined optionals. */
export function spatialImportRowToJson(
  row: SpatialImportRow
): Record<string, unknown> {
  const json: Record<string, unknown> = { building: row.building };
  if (row.floor !== undefined) json.floor = row.floor;
  if (row.zone !== undefined) json.zone = row.zone;
  if (row.element !== undefined) json.element = row.element;
  if (row.levelIndex !== undefined) json.levelIndex = row.levelIndex;
  if (row.elementType !== undefined) json.elementType = row.elementType;
  return json;
}

/** Serializes a {@link SpatialImportRequest} into the backend body. */
export function spatialImportToJson(
  dto: SpatialImportRequest
): Record<string, unknown> {
  return { rows: dto.rows.map((row) => spatialImportRowToJson(row)) };
}
