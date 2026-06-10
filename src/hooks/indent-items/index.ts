/**
 * @module hooks/indent-items
 *
 * Barrel export for the indent-items sub-domain — the key factory,
 * query hooks, and mutation hooks. Mutations patch the parent indent's
 * `items` array via `indentsKeys.detail(indentId)` (see
 * {@link useCreateIndentItem} and friends for the cache-strategy note).
 */
export * from './keys';
export * from './use-indent-items';
export * from './use-indent-item-mutations';
