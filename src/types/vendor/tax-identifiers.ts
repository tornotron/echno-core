// types/vendor/tax-identifiers.ts

export interface VendorTaxIdentifier {
  id: number;
  type: string; // "GST" | "PAN" | ...
  value: string;
}
