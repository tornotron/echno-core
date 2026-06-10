/**
 * @module types/indent-items
 *
 * Barrel export for the indent-items sub-domain. Re-exports the
 * {@link IndentItem} type and its create/update DTOs from
 * `types/indents/` so consumers that only need line-item types can
 * import them without pulling in the parent {@link Indent} graph.
 */
export * from '../indents/indent-item';
export * from '../indents/indent-item-create';
export * from '../indents/indent-item-update';
