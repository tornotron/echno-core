/**
 * @module wbs-element
 *
 * Domain type and parser for a single node in a project's
 * Work-Breakdown-Structure (WBS) tree. Each element is scoped to one
 * project (`projectId`), references its parent via `parentElementId`
 * (root nodes have `undefined`), and may carry `children` when the
 * server returns a tree-shaped payload.
 */
import { parsePositiveInt } from "../../lib/utils/parse-id";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * A single node in a project's WBS hierarchy. The same shape is
 * returned for flat-list (`getAll`, `getLeaves`) and tree
 * (`getTree`) endpoints; only the tree endpoint populates `children`.
 */
export interface WbsElement {
  /** Surrogate primary key. */
  id: number;

  /** Surrogate ID of the project the element belongs to. */
  projectId: number;

  /** Human-readable element name (always present). */
  name: string;

  /**
   * Project-relative code (e.g. `1.2.3`). Optional — the server
   * autogenerates it when omitted on create.
   */
  code?: string;

  /** Free-form long description. */
  description?: string;

  /**
   * Surrogate ID of the parent element. Absent for root nodes.
   * Reparenting goes through {@link useMoveWbsElement}, not the
   * standard update endpoint.
   */
  parentElementId?: number;

  /** Planned start date (parsed from an ISO 8601 string). */
  plannedStartDate?: Date;

  /** Planned end date (parsed from an ISO 8601 string). */
  plannedEndDate?: Date;

  /**
   * Lifecycle state. The server uses free-form strings here rather
   * than a closed enum, so consumers must match the values the backend
   * actually produces.
   */
  status?: string;

  /** Progress percentage (0-100). */
  progress?: number;

  /** Budget allocated to this element, in the project's currency. */
  allocatedBudget?: number;

  /**
   * Priority tag. Like {@link WbsElement.status}, the backend uses
   * free-form strings.
   */
  priority?: string;

  /**
   * Nested child elements. Only populated when the payload came from
   * the tree endpoint
   * (`GET /project/{projectId}/wbs/web/tree`); flat-list responses
   * leave this `undefined`.
   */
  children?: WbsElement[];
}

/**
 * Parses a raw WBS-element payload into a typed {@link WbsElement}.
 *
 * ISO 8601 date strings are eagerly converted to `Date` objects;
 * absent dates resolve to `undefined`. An absent or non-array
 * `children` resolves to `undefined` (not `[]`) so consumers can
 * distinguish "tree response with no children" from "flat-list
 * response".
 *
 * @param raw - The raw JSON object from the backend.
 * @returns The parsed {@link WbsElement} (recursively parsed for any
 *   nested children).
 * @throws {TypeError} When `raw.id` or `raw.projectId` is missing or
 *   non-positive (propagated from {@link parsePositiveInt}).
 */
export function parseWbsElement(raw: Raw): WbsElement {
  return {
    id: parsePositiveInt(raw.id, 'parseWbsElement.id'),
    projectId: parsePositiveInt(raw.projectId, 'parseWbsElement.projectId'),
    name: raw.name ?? '',
    code: raw.code ?? undefined,
    description: raw.description ?? undefined,
    parentElementId: raw.parentElementId ?? undefined,
    plannedStartDate: raw.plannedStartDate
      ? new Date(raw.plannedStartDate)
      : undefined,
    plannedEndDate: raw.plannedEndDate
      ? new Date(raw.plannedEndDate)
      : undefined,
    status: raw.status ?? undefined,
    progress: raw.progress ?? undefined,
    allocatedBudget: raw.allocatedBudget ?? undefined,
    priority: raw.priority ?? undefined,
    children: Array.isArray(raw.children)
      ? (raw.children as Raw[]).map((child: Raw) => parseWbsElement(child))
      : undefined,
  };
}
