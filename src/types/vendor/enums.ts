// types/vendor/enums.ts

export enum VendorType {
  MATERIALS = 'MATERIALS',
  EQUIPMENTS = 'EQUIPMENTS',
  SERVICES = 'SERVICES',
  TRANSPORT = 'TRANSPORT',
  OTHERS = 'OTHERS',
}

export enum VendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLACKLISTED = 'BLACKLISTED',
}

export enum PaymentTerms {
  IMMEDIATE = 'IMMEDIATE',
  NET15 = 'NET15',
  NET20 = 'NET20',
  NET30 = 'NET30',
  NET60 = 'NET60',
  NET90 = 'NET90',
}

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  [VendorType.MATERIALS]: 'Materials',
  [VendorType.EQUIPMENTS]: 'Equipment',
  [VendorType.SERVICES]: 'Services',
  [VendorType.TRANSPORT]: 'Transport',
  [VendorType.OTHERS]: 'Others',
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  [VendorStatus.ACTIVE]: 'Active',
  [VendorStatus.INACTIVE]: 'Inactive',
  [VendorStatus.BLACKLISTED]: 'Blacklisted',
};

export const VENDOR_STATUS_COLORS: Record<VendorStatus, string> = {
  [VendorStatus.ACTIVE]: 'green',
  [VendorStatus.INACTIVE]: 'zinc',
  [VendorStatus.BLACKLISTED]: 'red',
};

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  [PaymentTerms.IMMEDIATE]: 'Immediate',
  [PaymentTerms.NET15]: 'Net 15 Days',
  [PaymentTerms.NET20]: 'Net 20 Days',
  [PaymentTerms.NET30]: 'Net 30 Days',
  [PaymentTerms.NET60]: 'Net 60 Days',
  [PaymentTerms.NET90]: 'Net 90 Days',
};

export const getVendorTypeLabel = (type: VendorType) =>
  VENDOR_TYPE_LABELS[type];
export const getVendorStatusLabel = (status: VendorStatus) =>
  VENDOR_STATUS_LABELS[status];
export const getVendorStatusColor = (status: VendorStatus) =>
  VENDOR_STATUS_COLORS[status];
export const getPaymentTermsLabel = (terms: PaymentTerms) =>
  PAYMENT_TERMS_LABELS[terms];
