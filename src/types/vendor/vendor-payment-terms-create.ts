export interface SetVendorPaymentTermsRequest {
  paymentTerms: string;
  creditLimit?: number;
  creditDays?: number;
}

export function setVendorPaymentTermsToJson(
  dto: SetVendorPaymentTermsRequest
): Record<string, unknown> {
  return {
    paymentTerms: dto.paymentTerms,
    creditLimit: dto.creditLimit,
    creditDays: dto.creditDays,
  };
}
