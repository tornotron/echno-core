/**
 * @module materials/enum
 *
 * Enumerated values shared by the materials domain.
 */

/**
 * Stock-availability classification for a {@link Material}.
 *
 * - `IN_STOCK` — current stock is above the configured `reorderLevel`.
 * - `LOW_STOCK` — current stock has fallen below `reorderLevel` but above zero.
 * - `OUT_OF_STOCK` — current stock is zero (or negative due to reconciliation).
 */
export type MaterialStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
