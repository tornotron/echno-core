/**
 * @module types/site-transfers
 *
 * Barrel export for the site-transfers domain — the {@link SiteTransfer}
 * and {@link SiteTransferItem} domain types and their parsers, plus the
 * create, receive and cancel request DTOs and their serializers.
 *
 * There is no status DTO. Since echno-backend#660 a transfer's status is
 * derived from movements and cannot be set from a payload; the two documents
 * that move it are the receipt and the cancellation.
 */
export * from './enums';
export * from './site-transfer-item';
export * from './site-transfer';
export * from './site-transfer-create';
export * from './site-transfer-receive';
export * from './site-transfer-cancel';
