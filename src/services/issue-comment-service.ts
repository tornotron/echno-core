import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { IssueComment, parseIssueComment } from '../types/issue/issue-comment';
import {
  CreateIssueCommentRequest,
  createIssueCommentToJson,
} from '../types/issue/issue-create';
import {
  UpdateIssueCommentRequest,
  updateIssueCommentToJson,
} from '../types/issue/issue-update';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseIssueComment(data: ApiResponse): IssueComment {
  try {
    return parseIssueComment(data);
  } catch (error) {
    logger.error('Failed to parse issue comment data:', error);
    throw new ApiError(
      'Failed to process issue comment data. Please try again.',
      422
    );
  }
}

function safeParseIssueComments(data: ApiResponse[]): IssueComment[] {
  if (!Array.isArray(data)) {
    throw new ApiError(
      'Expected an array of issue comments but received an invalid response shape.',
      422
    );
  }
  try {
    return data.map((item) => parseIssueComment(item));
  } catch (error) {
    logger.error('Failed to parse issue comments data:', error);
    throw new ApiError(
      'Failed to process issue comments data. Please try again.',
      422
    );
  }
}

export const issueCommentService = {
  async getAll(): Promise<IssueComment[]> {
    const data = await api.get<ApiResponse[]>('/issues/comments/web');
    return safeParseIssueComments(data);
  },

  async getById(id: number): Promise<IssueComment> {
    const data = await api.get<ApiResponse>(`/issues/comments/web/${id}`);
    return safeParseIssueComment(data);
  },

  async create(dto: CreateIssueCommentRequest): Promise<IssueComment> {
    const payload = createIssueCommentToJson(dto);
    const data = await api.post<ApiResponse>('/issues/comments/web', payload);
    return safeParseIssueComment(data);
  },

  async update(
    id: number,
    dto: UpdateIssueCommentRequest
  ): Promise<IssueComment> {
    const payload = updateIssueCommentToJson(dto);
    const data = await api.patch<ApiResponse>(
      `/issues/comments/web/${id}`,
      payload
    );
    return safeParseIssueComment(data);
  },

  async getByIssueId(issueId: number): Promise<IssueComment[]> {
    const data = await api.get<ApiResponse[]>(
      `/issues/comments/web/issueId/${issueId}`
    );
    return safeParseIssueComments(data);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/issues/comments/web/${id}`);
  },
};
