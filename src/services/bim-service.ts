/**
 * @module bim-service
 *
 * Typed client for the BIM module (`/api/v1/bim`, `MODULE_BIM`). One surface,
 * no `/web` twin. Reads need `bim.view`; writes need `bim.manage`.
 *
 * The upload path is three calls the caller strings together:
 * {@link bimService.presignSource} creates the next version and returns a
 * presigned PUT, the caller PUTs the IFC straight to the object store with
 * {@link attachmentService.putToStorage}, then {@link bimService.registerSource}
 * marks the version UPLOADED and {@link bimService.enqueueImport} hands it to
 * the worker. Poll the job with {@link bimService.getJob}.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  BimElement,
  BimElementListParams,
  BimElementPage,
  BimHierarchyProposal,
  BimImportJob,
  BimModel,
  BimModelVersion,
  BimSourceUpload,
  BimTileManifest,
  ConfirmBimHierarchyRequest,
  CreateBimModelRequest,
  MergeBimElementRequest,
  PresignBimSourceRequest,
  confirmBimHierarchyToJson,
  createBimModelToJson,
  mergeBimElementToJson,
  parseBimElement,
  parseBimElementPage,
  parseBimHierarchyProposal,
  parseBimImportJob,
  parseBimModel,
  parseBimModelVersion,
  parseBimSourceUpload,
  parseBimTileManifest,
  presignBimSourceToJson,
} from '../types/bim/bim';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/bim';

function version(modelId: string, versionId: string): string {
  return `${BASE}/models/${modelId}/versions/${versionId}`;
}

function failed(what: string, error: unknown): ApiError {
  logger.error(`Failed to parse ${what}:`, error);
  return new ApiError('Failed to process BIM data. Please try again.', 422);
}

function parseWith<T>(what: string, data: ApiResponse, parse: (j: unknown) => T): T {
  try {
    return parse(data);
  } catch (error) {
    throw failed(what, error);
  }
}

function parseList<T>(what: string, data: ApiResponse, parse: (j: unknown) => T): T[] {
  if (!Array.isArray(data)) {
    throw failed(what, new Error('Expected an array'));
  }
  return data.map((item) => parseWith(what, item, parse));
}

export const bimService = {
  /** `GET /bim/projects/{projectId}/models`: a project's models, versions newest first. */
  async listModels(projectId: number): Promise<BimModel[]> {
    const data = await api.get<ApiResponse>(`${BASE}/projects/${projectId}/models`);
    return parseList('BIM models', data, parseBimModel);
  },

  /** `POST /bim/projects/{projectId}/models`: registers a model; versions come from uploads. */
  async createModel(projectId: number, req: CreateBimModelRequest): Promise<BimModel> {
    const data = await api.post<ApiResponse>(
      `${BASE}/projects/${projectId}/models`,
      createBimModelToJson(req)
    );
    return parseWith('BIM model', data, parseBimModel);
  },

  /** `GET /bim/models/{modelId}` */
  async getModel(modelId: string): Promise<BimModel> {
    const data = await api.get<ApiResponse>(`${BASE}/models/${modelId}`);
    return parseWith('BIM model', data, parseBimModel);
  },

  /** `GET /bim/models/{modelId}/versions/{versionId}` */
  async getVersion(modelId: string, versionId: string): Promise<BimModelVersion> {
    const data = await api.get<ApiResponse>(version(modelId, versionId));
    return parseWith('BIM model version', data, parseBimModelVersion);
  },

  /**
   * `POST /bim/models/{modelId}/versions/presign`: declares the IFC about to
   * be uploaded. Creates the next version and returns where to PUT it. The
   * backend refuses a `fileSize` above 1 GB.
   */
  async presignSource(
    modelId: string,
    req: PresignBimSourceRequest
  ): Promise<BimSourceUpload> {
    const data = await api.post<ApiResponse>(
      `${BASE}/models/${modelId}/versions/presign`,
      presignBimSourceToJson(req)
    );
    return parseWith('BIM upload slot', data, parseBimSourceUpload);
  },

  /** `POST .../versions/{versionId}/register`: confirms the PUT landed. */
  async registerSource(modelId: string, versionId: string): Promise<BimModelVersion> {
    const data = await api.post<ApiResponse>(`${BASE}/models/${modelId}/versions/${versionId}/register`);
    return parseWith('BIM model version', data, parseBimModelVersion);
  },

  /** `POST .../versions/{versionId}/jobs`: queues the worker import. */
  async enqueueImport(modelId: string, versionId: string): Promise<BimImportJob> {
    const data = await api.post<ApiResponse>(`${BASE}/models/${modelId}/versions/${versionId}/jobs`);
    return parseWith('BIM import job', data, parseBimImportJob);
  },

  /** `GET .../versions/{versionId}/jobs`: every job of a version, latest first. */
  async listJobs(modelId: string, versionId: string): Promise<BimImportJob[]> {
    const data = await api.get<ApiResponse>(`${BASE}/models/${modelId}/versions/${versionId}/jobs`);
    return parseList('BIM import jobs', data, parseBimImportJob);
  },

  /** `GET /bim/jobs/{jobId}`: one job, for polling. */
  async getJob(jobId: string): Promise<BimImportJob> {
    const data = await api.get<ApiResponse>(`${BASE}/jobs/${jobId}`);
    return parseWith('BIM import job', data, parseBimImportJob);
  },

  /**
   * `GET /bim/models/{modelId}/elements`: a page of the model's elements,
   * optionally one storey's, retired rows excluded unless asked for.
   */
  async listElements(
    modelId: string,
    params: BimElementListParams = {}
  ): Promise<BimElementPage> {
    const query: Record<string, string | number | boolean> = {};
    if (params.storeyGlobalId) query.storeyGlobalId = params.storeyGlobalId;
    if (params.includeRetired !== undefined) query.includeRetired = params.includeRetired;
    if (params.page !== undefined) query.page = params.page;
    if (params.size !== undefined) query.size = params.size;
    const data = await api.get<ApiResponse>(`${BASE}/models/${modelId}/elements`, query);
    return parseWith('BIM elements', data, parseBimElementPage);
  },

  /** `GET /bim/elements/{elementId}` */
  async getElement(elementId: string): Promise<BimElement> {
    const data = await api.get<ApiResponse>(`${BASE}/elements/${elementId}`);
    return parseWith('BIM element', data, parseBimElement);
  },

  /**
   * Finds one element of a model by its IFC GlobalId. The backend has no
   * by-GlobalId route, so this pages through the storey (or the whole model
   * when the storey is unknown) until the id turns up; `undefined` when it
   * never does.
   */
  async findElementByGlobalId(
    modelId: string,
    globalId: string,
    storeyGlobalId?: string
  ): Promise<BimElement | undefined> {
    const size = 500;
    for (let page = 0; ; page += 1) {
      const result = await bimService.listElements(modelId, {
        storeyGlobalId,
        includeRetired: true,
        page,
        size,
      });
      const hit = result.content.find((e) => e.globalId === globalId);
      if (hit) return hit;
      if (page + 1 >= result.totalPages || result.content.length === 0) return undefined;
    }
  },

  /** `POST /bim/elements/{elementId}/merge`: carries a retired element's link onto its replacement. */
  async mergeElement(elementId: string, req: MergeBimElementRequest): Promise<BimElement> {
    const data = await api.post<ApiResponse>(
      `${BASE}/elements/${elementId}/merge`,
      mergeBimElementToJson(req)
    );
    return parseWith('BIM element', data, parseBimElement);
  },

  /** `GET .../versions/{versionId}/tiles`: presigned tile urls, short-lived. */
  async getTiles(modelId: string, versionId: string): Promise<BimTileManifest> {
    const data = await api.get<ApiResponse>(`${version(modelId, versionId)}/tiles`);
    return parseWith('BIM tile manifest', data, parseBimTileManifest);
  },

  /** `GET .../hierarchy/proposal`: the proposed site structure, pending confirmation. */
  async getHierarchyProposal(
    modelId: string,
    versionId: string
  ): Promise<BimHierarchyProposal> {
    const data = await api.get<ApiResponse>(
      `${BASE}/models/${modelId}/versions/${versionId}/hierarchy/proposal`
    );
    return parseWith('BIM hierarchy proposal', data, parseBimHierarchyProposal);
  },

  /** `POST .../hierarchy/proposal`: regenerates the proposal from the worker's structure. */
  async regenerateHierarchyProposal(
    modelId: string,
    versionId: string
  ): Promise<BimHierarchyProposal> {
    const data = await api.post<ApiResponse>(
      `${BASE}/models/${modelId}/versions/${versionId}/hierarchy/proposal`
    );
    return parseWith('BIM hierarchy proposal', data, parseBimHierarchyProposal);
  },

  /** `POST .../hierarchy/confirm`: creates or matches the proposed nodes. */
  async confirmHierarchy(
    modelId: string,
    versionId: string,
    req: ConfirmBimHierarchyRequest = {}
  ): Promise<BimHierarchyProposal> {
    const data = await api.post<ApiResponse>(
      `${BASE}/models/${modelId}/versions/${versionId}/hierarchy/confirm`,
      confirmBimHierarchyToJson(req)
    );
    return parseWith('BIM hierarchy proposal', data, parseBimHierarchyProposal);
  },
};
