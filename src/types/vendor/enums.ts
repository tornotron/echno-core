/**
 * @module vendor-enums
 *
 * Closed string enums for the vendor domain plus their human-readable
 * label / color maps and lookup helpers. Enum values match the backend's
 * SCREAMING_SNAKE_CASE wire format and double as the API payload.
 */

/**
 * Trade category a vendor supplies.
 */
export enum VendorType {
  /** Building materials, consumables, hardware. */
  MATERIALS = 'MATERIALS',

  /** Machinery, plant equipment, tools. */
  EQUIPMENTS = 'EQUIPMENTS',

  /** Labour-only or consulting services. */
  SERVICES = 'SERVICES',

  /** Transport and logistics. */
  TRANSPORT = 'TRANSPORT',

  /** Anything that does not fit the other categories. */
  OTHERS = 'OTHERS',
}

/**
 * Current trading relationship between the organisation and the vendor.
 */
export enum VendorStatus {
  /** Currently approved for new purchase orders. */
  ACTIVE = 'ACTIVE',

  /** Paused — no new orders but existing obligations remain. */
  INACTIVE = 'INACTIVE',

  /** Banned — must not be used; flagged for compliance reasons. */
  BLACKLISTED = 'BLACKLISTED',
}

/**
 * Credit-period agreement governing how long the organisation has to settle
 * an invoice. `IMMEDIATE` means cash-on-delivery; `NET{n}` means `n` days
 * from invoice date.
 */
export enum PaymentTerms {
  /** Payment due on delivery / invoice receipt. */
  IMMEDIATE = 'IMMEDIATE',

  /** 15-day credit period. */
  NET15 = 'NET15',

  /** 20-day credit period. */
  NET20 = 'NET20',

  /** 30-day credit period. */
  NET30 = 'NET30',

  /** 60-day credit period. */
  NET60 = 'NET60',

  /** 90-day credit period. */
  NET90 = 'NET90',
}

/** Human-readable labels for each {@link VendorType} value. */
export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  [VendorType.MATERIALS]: 'Materials',
  [VendorType.EQUIPMENTS]: 'Equipment',
  [VendorType.SERVICES]: 'Services',
  [VendorType.TRANSPORT]: 'Transport',
  [VendorType.OTHERS]: 'Others',
};

/** Human-readable labels for each {@link VendorStatus} value. */
export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  [VendorStatus.ACTIVE]: 'Active',
  [VendorStatus.INACTIVE]: 'Inactive',
  [VendorStatus.BLACKLISTED]: 'Blacklisted',
};

/**
 * UI badge colour token for each {@link VendorStatus}. Values are intended
 * for use with a colour-palette utility, not as raw CSS.
 */
export const VENDOR_STATUS_COLORS: Record<VendorStatus, string> = {
  [VendorStatus.ACTIVE]: 'green',
  [VendorStatus.INACTIVE]: 'zinc',
  [VendorStatus.BLACKLISTED]: 'red',
};

/** Human-readable labels for each {@link PaymentTerms} value. */
export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  [PaymentTerms.IMMEDIATE]: 'Immediate',
  [PaymentTerms.NET15]: 'Net 15 Days',
  [PaymentTerms.NET20]: 'Net 20 Days',
  [PaymentTerms.NET30]: 'Net 30 Days',
  [PaymentTerms.NET60]: 'Net 60 Days',
  [PaymentTerms.NET90]: 'Net 90 Days',
};

/**
 * Returns the display label for a vendor type.
 *
 * @param type - The vendor type to look up.
 * @returns The human-readable label.
 */
export const getVendorTypeLabel = (type: VendorType) =>
  VENDOR_TYPE_LABELS[type];

/**
 * Returns the display label for a vendor status.
 *
 * @param status - The vendor status to look up.
 * @returns The human-readable label.
 */
export const getVendorStatusLabel = (status: VendorStatus) =>
  VENDOR_STATUS_LABELS[status];

/**
 * Returns the UI badge colour token for a vendor status.
 *
 * @param status - The vendor status to look up.
 * @returns The colour token (e.g. `"green"`, `"zinc"`, `"red"`).
 */
export const getVendorStatusColor = (status: VendorStatus) =>
  VENDOR_STATUS_COLORS[status];

/**
 * Returns the display label for a payment-terms code.
 *
 * @param terms - The payment-terms code to look up.
 * @returns The human-readable label.
 */
export const getPaymentTermsLabel = (terms: PaymentTerms) =>
  PAYMENT_TERMS_LABELS[terms];
