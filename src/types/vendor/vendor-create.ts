import { VendorType, VendorStatus } from './enums';

export interface CreateVendorRequest {
  name: string;
  email: string;
  address?: string;
  website?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  type?: VendorType;
  status?: VendorStatus;
  notes?: string;
}

export function createVendorToJson(
  dto: CreateVendorRequest
): Record<string, unknown> {
  return {
    vendorName: dto.name,
    vendorEmail: dto.email,
    vendorAddress: dto.address,
    website: dto.website,
    city: dto.city,
    state: dto.state,
    pinCode: dto.pincode,
    country: dto.country,
    type: dto.type,
    status: dto.status,
    notes: dto.notes,
  };
}
