export interface CreateVendorContactRequest {
  contactPerson?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  primary?: boolean;
}

export function createVendorContactToJson(
  dto: CreateVendorContactRequest
): Record<string, unknown> {
  return {
    contactPerson: dto.contactPerson,
    email: dto.email,
    phone: dto.phone,
    alternatePhone: dto.alternatePhone,
    primary: dto.primary,
  };
}

export interface UpdateVendorContactRequest {
  contactPerson?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  primary?: boolean;
}

export function updateVendorContactToJson(
  dto: UpdateVendorContactRequest
): Record<string, unknown> {
  return {
    contactPerson: dto.contactPerson,
    email: dto.email,
    phone: dto.phone,
    alternatePhone: dto.alternatePhone,
    primary: dto.primary,
  };
}
