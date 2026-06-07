import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Organization,
  parseOrganization,
} from '../types/organization/organization';
import {
  CreateOrganizationRequest,
  createOrganizationToJson,
} from '../types/organization/organization-create';
import {
  UpdateOrganizationRequest,
  updateOrganizationToJson,
} from '../types/organization/organization-update';
import { OrganizationFiles } from '../types/organization/organization-files';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseOrganization(data: ApiResponse): Organization {
  try {
    return parseOrganization(data);
  } catch (error) {
    logger.error('Failed to parse organization data:', error);
    throw new ApiError(
      'Failed to process organization data. Please try again.',
      422
    );
  }
}

function safeParseOrganizations(data: ApiResponse[]): Organization[] {
  if (!Array.isArray(data)) {
    return [];
  }
  try {
    return data.map((item) => parseOrganization(item));
  } catch (error) {
    logger.error('Failed to parse organizations data:', error);
    throw new ApiError(
      'Failed to process organizations data. Please try again.',
      422
    );
  }
}

export const organizationService = {
  async getAll(): Promise<Organization[]> {
    const data = await api.get<ApiResponse[]>('/organization/web');
    return safeParseOrganizations(data);
  },

  async getById(id: number): Promise<Organization> {
    const data = await api.get<ApiResponse>(`/organization/web/${id}`);
    return safeParseOrganization(data);
  },

  async create(
    dto: CreateOrganizationRequest,
    files?: OrganizationFiles
  ): Promise<Organization> {
    const payload = createOrganizationToJson(dto);
    const fileMap = files?.logo ? { attachments: [files.logo] } : undefined;
    const data = await api.postMultipart<ApiResponse>(
      '/organization/web',
      payload,
      fileMap
    );
    return safeParseOrganization(data);
  },

  async update(
    id: number,
    dto: UpdateOrganizationRequest,
    files?: OrganizationFiles
  ): Promise<Organization> {
    const payload = updateOrganizationToJson(dto);
    const fileMap = files?.logo ? { attachments: [files.logo] } : undefined;
    const data = await api.patchMultipart<ApiResponse>(
      `/organization/web/${id}`,
      payload,
      fileMap
    );
    return safeParseOrganization(data);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/organization/web/${id}`);
  },
};
