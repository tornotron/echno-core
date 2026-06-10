export interface CreateVendorTaxIdentifierRequest {
  type: string;
  value: string;
}

export function createVendorTaxIdentifierToJson(
  dto: CreateVendorTaxIdentifierRequest
): Record<string, unknown> {
  return {
    type: dto.type,
    value: dto.value,
  };
}

export interface UpdateVendorTaxIdentifierRequest {
  type?: string;
  value?: string;
}

export function updateVendorTaxIdentifierToJson(
  dto: UpdateVendorTaxIdentifierRequest
): Record<string, unknown> {
  return {
    type: dto.type,
    value: dto.value,
  };
}
