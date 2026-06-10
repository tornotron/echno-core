/**
 * @module hooks/inventory-transactions
 *
 * Barrel export for the inventory-transactions module — the key
 * factory and read-only query hooks. No mutation hooks are exported;
 * transactions are written automatically by backend events.
 */
export * from './keys';
export * from './use-inventory-transactions';
