// types/vendor/payment-terms.ts

export interface VendorPaymentTermsDetails {
  id: number;
  paymentTerms: string;
  creditLimit?: number;
  creditDays?: number;
}
