import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { Issue, parseIssue, IssueFiles } from '../types/issue';
import {
  CreateIssueRequest,
  createIssueToJson,
} from '../types/issue/issue-create';
import {
  UpdateIssueRequest,
  updateIssueToJson,
} from '../types/issue/issue-update';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseIssue(data: ApiResponse): Issue {
  try {
    return parseIssue(data);
  } catch (error) {
    logger.error('Failed to parse issue data:', error);
    throw new ApiError('Failed to process issue data. Please try again.', 422);
  }
}

function safeParseIssues(data: ApiResponse[]): Issue[] {
  if (!Array.isArray(data)) {
    logger.error(
      'Invalid issues payload: expected array, received:',
      `type=${typeof data}, isNull=${data === null}${
        typeof data === 'object' && data !== null
          ? `, keys=${Object.keys(data).slice(0, 5).join(',')}`
          : ''
      }`
    );
    throw new ApiError('Invalid issues payload: expected array.', 422);
  }
  try {
    return data.map((item) => parseIssue(item));
  } catch (error) {
    logger.error('Failed to parse issues data:', error);
    throw new ApiError('Failed to process issues data. Please try again.', 422);
  }
}

export const issueService = {
  async getAll(): Promise<Issue[]> {
    const data = await api.get<ApiResponse[]>('/issues/web');
    return safeParseIssues(data);
  },

  async getById(id: number): Promise<Issue> {
    const data = await api.get<ApiResponse>(`/issues/web/${id}`);
    return safeParseIssue(data);
  },

  async create(dto: CreateIssueRequest, files?: IssueFiles): Promise<Issue> {
    const payload = createIssueToJson(dto);
    const hasFiles = files?.attachments && files.attachments.length > 0;

    if (!hasFiles) {
      payload.attachments = [];
    }

    const data = await api.postMultipart<ApiResponse>(
      '/issues/web',
      payload,
      hasFiles ? { attachments: files!.attachments! } : undefined
    );
    return safeParseIssue(data);
  },

  async update(
    id: number,
    dto: UpdateIssueRequest,
    files?: IssueFiles
  ): Promise<Issue> {
    const payload = updateIssueToJson(dto);
    const hasFiles = files?.attachments && files.attachments.length > 0;

    if (!hasFiles) {
      payload.attachments = [];
    }

    const data = await api.patchMultipart<ApiResponse>(
      `/issues/web/${id}`,
      payload,
      hasFiles ? { attachments: files!.attachments! } : undefined
    );
    return safeParseIssue(data);
  },

  async getByProjectId(projectId: number): Promise<Issue[]> {
    const data = await api.get<ApiResponse[]>(
      `/issues/web/project/${projectId}`
    );
    return safeParseIssues(data);
  },

  async getByTaskId(taskId: number): Promise<Issue[]> {
    const data = await api.get<ApiResponse[]>(`/issues/web/taskId/${taskId}`);
    return safeParseIssues(data);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/issues/web/${id}`);
  },
};
