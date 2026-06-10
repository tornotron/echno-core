// types/vendor/bank-accounts.ts

export interface VendorBankAccount {
  id: number;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  swift?: string;
  default: boolean;
}
