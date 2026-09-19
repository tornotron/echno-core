/**
 * TanStack Query key factory for the Toolbox Talks domain.
 *
 * Key shapes:
 * - `['toolbox-talks']`: namespace root; the invalidation prefix.
 * - `['toolbox-talks', 'list', params]`: one page of the list.
 * - `['toolbox-talks', 'detail', id]`: one talk.
 * - `['toolbox-talks', 'detail', id, 'photos']`: a talk's evidence.
 *
 * Every mutation invalidates `toolboxTalksKeys.all`, so a create, update,
 * attendance change or record refreshes every list page and any open
 * detail in one sweep.
 */
import type { ToolboxTalkListParams } from '../../types/toolbox-talks/toolbox-talks';

export const toolboxTalksKeys = {
  all: ['toolbox-talks'] as const,
  lists: () => [...toolboxTalksKeys.all, 'list'] as const,
  list: (params: ToolboxTalkListParams = {}) =>
    [...toolboxTalksKeys.lists(), params] as const,
  details: () => [...toolboxTalksKeys.all, 'detail'] as const,
  detail: (id: string) => [...toolboxTalksKeys.details(), id] as const,
  photos: (id: string) => [...toolboxTalksKeys.detail(id), 'photos'] as const,
};
