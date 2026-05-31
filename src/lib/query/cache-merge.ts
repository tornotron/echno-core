/**
 * @module cache-merge
 *
 * Cache merge helpers for mutation responses that return partial DTOs.
 *
 * Many backend mutation endpoints return a "simple" DTO (e.g. `ProjectSimpleDto`,
 * `TaskSimpleDto`) that omits nested collections — or a generic `ResponseDto`
 * ack that contains no domain data at all. Using `setQueryData(detail, response)`
 * directly with such a response silently drops nested fields from the cache
 * (attachments, members, subtasks, comments, …) until the next refetch.
 *
 * `mergePreservingNested` is the canonical replacement: scalar fields from the
 * response overwrite the cache; nested keys are preserved from cache when the
 * response omits them (undefined/null/empty array).
 *
 * Usage pattern (with invalidate as the safety net):
 *
 *   queryClient.setQueryData(detail(id), (old) =>
 *     old
 *       ? mergePreservingNested(old, response, ['attachments', 'members', 'tasks'])
 *       : response,
 *   );
 *   queryClient.invalidateQueries({ queryKey: detail(id) });
 */
/**
 * Merges a partial mutation response into a cached entity, preserving
 * nested collection fields that the backend omits in simple DTOs.
 *
 * Scalar fields from `partial` overwrite the corresponding fields in
 * `cached`. For every key in `preserveKeys`, the value from `cached` is
 * kept whenever `partial` supplies `undefined`, `null`, or an empty array.
 *
 * @param cached - The current value held in the TanStack Query cache.
 * @param partial - The (possibly partial) object returned by the mutation endpoint.
 * @param preserveKeys - Keys whose cached values must not be overwritten by absent or empty partial values.
 * @returns A new merged object with scalar fields from `partial` and nested fields from `cached`.
 *
 * @example
 * ```ts
 * queryClient.setQueryData(projectKeys.detail(id), (old) =>
 *   old
 *     ? mergePreservingNested(old, response, ['attachments', 'members', 'tasks'])
 *     : response,
 * );
 * ```
 */
export function mergePreservingNested<T extends object>(
  cached: T,
  partial: Partial<T>,
  preserveKeys: ReadonlyArray<keyof T>
): T {
  const merged = { ...cached, ...partial };
  for (const key of preserveKeys) {
    const incoming = (partial as Record<keyof T, unknown>)[key];
    const isEmpty =
      incoming == null || (Array.isArray(incoming) && incoming.length === 0);
    if (isEmpty) {
      merged[key] = cached[key];
    }
  }
  return merged;
}
