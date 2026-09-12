/**
 * @module spatial-service
 *
 * Typed client for a project's site structure
 * (`/api/v1/project/{projectId}/spatial`, tornotron/echno-backend#768/#773).
 *
 * Wraps `api.*` calls and parses raw JSON into {@link SpatialTreeNode} and
 * {@link SpatialNode} objects. All functions throw {@link ApiError} on
 * non-2xx responses or parse failures.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  CreateSpatialNodeRequest,
  MoveSpatialNodeRequest,
  SpatialImportRequest,
  SpatialImportResult,
  SpatialNode,
  SpatialTreeNode,
  UpdateSpatialNodeRequest,
  createSpatialNodeToJson,
  moveSpatialNodeToJson,
  parseSpatialImportResult,
  parseSpatialNode,
  parseSpatialTreeNode,
  spatialImportToJson,
  updateSpatialNodeToJson,
} from '../types/spatial/spatial';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function base(projectId: number): string {
  return `/project/${projectId}/spatial`;
}

function failed(what: string, error: unknown): ApiError {
  logger.error(`Failed to parse ${what}:`, error);
  return new ApiError(
    'Failed to process site structure data. Please try again.',
    422
  );
}

function safeParseTree(data: ApiResponse): SpatialTreeNode[] {
  if (!Array.isArray(data)) {
    throw failed('spatial tree', new Error('Expected an array of nodes'));
  }
  try {
    return data.map((item) => parseSpatialTreeNode(item));
  } catch (error) {
    throw failed('spatial tree', error);
  }
}

function safeParseNode(data: ApiResponse): SpatialNode {
  try {
    return parseSpatialNode(data);
  } catch (error) {
    throw failed('spatial node', error);
  }
}

export const spatialService = {
  /**
   * Fetches the whole site structure of a project, nested.
   *
   * `GET /project/{projectId}/spatial`
   *
   * @param projectId - The project.
   * @param includeArchived - Also return archived nodes (default false).
   */
  async getTree(
    projectId: number,
    includeArchived = false
  ): Promise<SpatialTreeNode[]> {
    const query: Record<string, string | number | boolean> = {};
    if (includeArchived) query.includeArchived = true;
    const data = await api.get<ApiResponse>(base(projectId), query);
    return safeParseTree(data);
  },

  /**
   * Fetches one node with its breadcrumb.
   *
   * `GET /project/{projectId}/spatial/nodes/{nodeId}`
   */
  async getNode(projectId: number, nodeId: string): Promise<SpatialNode> {
    const data = await api.get<ApiResponse>(
      `${base(projectId)}/nodes/${nodeId}`
    );
    return safeParseNode(data);
  },

  /**
   * Adds a node under a parent of the level above it.
   *
   * `POST /project/{projectId}/spatial/nodes`
   */
  async createNode(
    projectId: number,
    req: CreateSpatialNodeRequest
  ): Promise<SpatialNode> {
    const data = await api.post<ApiResponse>(
      `${base(projectId)}/nodes`,
      createSpatialNodeToJson(req)
    );
    return safeParseNode(data);
  },

  /**
   * Renames or re-labels a node; omitted fields are left as they are.
   *
   * `PATCH /project/{projectId}/spatial/nodes/{nodeId}`
   */
  async updateNode(
    projectId: number,
    nodeId: string,
    req: UpdateSpatialNodeRequest
  ): Promise<SpatialNode> {
    const data = await api.patch<ApiResponse>(
      `${base(projectId)}/nodes/${nodeId}`,
      updateSpatialNodeToJson(req)
    );
    return safeParseNode(data);
  },

  /**
   * Re-parents a node under an active node of the level above.
   *
   * `POST /project/{projectId}/spatial/nodes/{nodeId}/move`
   */
  async moveNode(
    projectId: number,
    nodeId: string,
    req: MoveSpatialNodeRequest
  ): Promise<SpatialNode> {
    const data = await api.post<ApiResponse>(
      `${base(projectId)}/nodes/${nodeId}/move`,
      moveSpatialNodeToJson(req)
    );
    return safeParseNode(data);
  },

  /**
   * Archives a node and its subtree. References to it stay valid.
   *
   * `POST /project/{projectId}/spatial/nodes/{nodeId}/archive`
   */
  async archiveNode(projectId: number, nodeId: string): Promise<SpatialNode> {
    const data = await api.post<ApiResponse>(
      `${base(projectId)}/nodes/${nodeId}/archive`
    );
    return safeParseNode(data);
  },

  /**
   * Restores an archived node and its subtree.
   *
   * `POST /project/{projectId}/spatial/nodes/{nodeId}/restore`
   */
  async restoreNode(projectId: number, nodeId: string): Promise<SpatialNode> {
    const data = await api.post<ApiResponse>(
      `${base(projectId)}/nodes/${nodeId}/restore`
    );
    return safeParseNode(data);
  },

  /**
   * Bulk-imports a site structure from spreadsheet rows. Idempotent: nodes
   * already on a code path are skipped.
   *
   * `POST /project/{projectId}/spatial/import`
   */
  async importRows(
    projectId: number,
    req: SpatialImportRequest
  ): Promise<SpatialImportResult> {
    const data = await api.post<ApiResponse>(
      `${base(projectId)}/import`,
      spatialImportToJson(req)
    );
    try {
      return parseSpatialImportResult(data);
    } catch (error) {
      throw failed('spatial import result', error);
    }
  },
};
