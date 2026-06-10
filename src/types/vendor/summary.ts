// types/vendor/summary.ts

export interface VendorSummary {
  vendorId: number;
  vendorName: string;
  totalOrders?: number;
  pendingOrders?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  totalPurchaseValue?: number;
  totalPaid?: number;
  totalOutstanding?: number;
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
}
