/**
 * @module inventory-transactions/enums
 *
 * Enumerated values shared by the inventory-transactions domain.
 */

/**
 * Classification of an {@link InventoryTransaction}. The transaction
 * type encodes both the source event (GRN, consumption, transfer,
 * stock-take) and its direction (in / out). Transactions are written
 * automatically by backend events; the type is set server-side at the
 * point each event commits.
 */
export enum InventoryTransactionType {
  /** Initial balance set when stock is first opened in a location. */
  openingBalance = 'OPENING_BALANCE',

  /** Goods receipt note — materials received against a purchase order. */
  grn = 'GRN',

  /** Goods returned to the vendor after receipt. */
  purchaseReturn = 'PURCHASE_RETURN',

  /** Generic usage / issue-out of materials. */
  use = 'USE',

  /** Materials consumed in a production run. */
  productionConsume = 'PRODUCTION_CONSUME',

  /** Materials produced as output of a production run. */
  productionOutput = 'PRODUCTION_OUTPUT',

  /** Scrapped materials written off as unusable. */
  scrap = 'SCRAP',

  /** Materials written off due to damage. */
  damage = 'DAMAGE',

  /** Materials written off because they expired. */
  expire = 'EXPIRE',

  /** Materials written off as lost (cause unknown / unrecorded). */
  loss = 'LOSS',

  /** Stock leaving a location as part of a site transfer. */
  transferOut = 'TRANSFER_OUT',

  /** Stock arriving at a location as part of a site transfer. */
  transferIn = 'TRANSFER_IN',

  /** Materials returned by a customer. */
  customerReturn = 'CUSTOMER_RETURN',

  /** Positive variance discovered during a physical stock take. */
  stockTakeGain = 'STOCK_TAKE_GAIN',

  /** Negative variance discovered during a physical stock take. */
  stockTakeLoss = 'STOCK_TAKE_LOSS',

  /** Generic write-off (catch-all for losses without a specific cause). */
  writeOff = 'WRITE_OFF',

  /** Manual adjustment booked by an operator (positive or negative). */
  adjust = 'ADJUST',
}

/**
 * Human-readable label for each {@link InventoryTransactionType}. Use
 * this when rendering the enum in the UI; the enum value remains the
 * API of record.
 */
export const inventoryTransactionTypeLabels: Record<
  InventoryTransactionType,
  string
> = {
  [InventoryTransactionType.openingBalance]: 'Opening Balance',
  [InventoryTransactionType.grn]: 'GRN',
  [InventoryTransactionType.purchaseReturn]: 'Purchase Return',
  [InventoryTransactionType.use]: 'Usage',
  [InventoryTransactionType.productionConsume]: 'Production Consume',
  [InventoryTransactionType.productionOutput]: 'Production Output',
  [InventoryTransactionType.scrap]: 'Scrap',
  [InventoryTransactionType.damage]: 'Damage',
  [InventoryTransactionType.expire]: 'Expire',
  [InventoryTransactionType.loss]: 'Loss',
  [InventoryTransactionType.transferOut]: 'Transfer Out',
  [InventoryTransactionType.transferIn]: 'Transfer In',
  [InventoryTransactionType.customerReturn]: 'Customer Return',
  [InventoryTransactionType.stockTakeGain]: 'Stock Take Gain',
  [InventoryTransactionType.stockTakeLoss]: 'Stock Take Loss',
  [InventoryTransactionType.writeOff]: 'Write Off',
  [InventoryTransactionType.adjust]: 'Adjustment',
};

/**
 * Tailwind badge utility classes (background + text) for each
 * {@link InventoryTransactionType}. Sourced from echno-web's status-pill
 * design; downstream consumers may override via their own theme map.
 */
export const inventoryTransactionTypeBadgeColors: Record<
  InventoryTransactionType,
  string
> = {
  [InventoryTransactionType.openingBalance]: 'bg-gray-100 text-gray-700',
  [InventoryTransactionType.grn]: 'bg-green-100 text-green-700',
  [InventoryTransactionType.purchaseReturn]: 'bg-orange-100 text-orange-700',
  [InventoryTransactionType.use]: 'bg-red-100 text-red-700',
  [InventoryTransactionType.productionConsume]: 'bg-red-100 text-red-700',
  [InventoryTransactionType.productionOutput]: 'bg-green-100 text-green-700',
  [InventoryTransactionType.scrap]: 'bg-zinc-100 text-zinc-700',
  [InventoryTransactionType.damage]: 'bg-rose-100 text-rose-700',
  [InventoryTransactionType.expire]: 'bg-amber-100 text-amber-700',
  [InventoryTransactionType.loss]: 'bg-red-100 text-red-700',
  [InventoryTransactionType.transferOut]: 'bg-purple-100 text-purple-700',
  [InventoryTransactionType.transferIn]: 'bg-indigo-100 text-indigo-700',
  [InventoryTransactionType.customerReturn]: 'bg-teal-100 text-teal-700',
  [InventoryTransactionType.stockTakeGain]: 'bg-green-100 text-green-700',
  [InventoryTransactionType.stockTakeLoss]: 'bg-red-100 text-red-700',
  [InventoryTransactionType.writeOff]: 'bg-zinc-100 text-zinc-700',
  [InventoryTransactionType.adjust]: 'bg-blue-100 text-blue-700',
};
