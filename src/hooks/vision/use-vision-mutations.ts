/**
 * @module use-vision-mutations
 *
 * Mutation hooks for the Computer Vision domain.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { visionService } from '../../services/vision-service';
import type {
  QueueVisionRunRequest,
  UpdateVisionSettingsRequest,
} from '../../types/vision/vision';
import { visionKeys } from './keys';

/**
 * Replaces the organization's inference settings. Mutate with the
 * {@link UpdateVisionSettingsRequest}. On success the saved settings are
 * written into the cache and the vision queries are refreshed.
 */
export function useUpdateVisionSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: UpdateVisionSettingsRequest) => visionService.updateSettings(req),
    onSuccess: (settings) => {
      queryClient.setQueryData(visionKeys.settings(), settings);
      queryClient.invalidateQueries({ queryKey: visionKeys.all });
    },
  });
}

/**
 * Queues inference on a set of images. Mutate with the
 * {@link QueueVisionRunRequest}; resolves to the queued and skipped counts.
 *
 * Nothing cached changes when a run is queued: the detections arrive later
 * as pending observations, picked up when the observation queue next
 * refetches.
 */
export function useQueueVisionRun() {
  return useMutation({
    mutationFn: (req: QueueVisionRunRequest) => visionService.queueRun(req),
  });
}
