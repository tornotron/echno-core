// types/vendor/vendor.ts

import { Attachment } from '../attachment';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { VendorType, VendorStatus, PaymentTerms } from './enums';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { VendorContact } from './contacts';
import { VendorTaxIdentifier } from './tax-identifiers';
import { VendorBankAccount } from './bank-accounts';
import { VendorPaymentTermsDetails } from './payment-terms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export interface Vendor {
  id: number;
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
  // from contacts[] primary/first
  contactPerson?: string;
  phone?: string;
  alternatePhone?: string;
  // from taxIdentifiers[] by type
  gstNumber?: string;
  panNumber?: string;
  // from bankAccounts[] default/first
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  swift?: string;
  // from paymentTerms object
  paymentTerms?: PaymentTerms;
  creditLimit?: number;
  creditDays?: number;
  // financial summary
  totalPurchaseValue?: number;
  totalPaid?: number;
  totalOutstanding?: number;
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
  totalOrders?: number;
  pendingOrders?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  attachments?: Attachment[];
  createdAt?: Date;
  updatedAt?: Date;
}

export function parseVendor(raw: Raw): Vendor {
  const id = parsePositiveInt(raw.id, 'parseVendor.id');
  const name = raw.vendorName ?? raw.name ?? '';
  const email = raw.vendorEmail ?? raw.email ?? '';
  if (!name) {
    throw new Error(`parseVendor: vendor id=${id} has no name`);
  }

  const contacts: VendorContact[] = raw.contacts ?? [];
  const contact = contacts.find((c) => c.primary) ?? contacts[0];

  const taxIds: VendorTaxIdentifier[] = raw.taxIdentifiers ?? [];
  const bankAccounts: VendorBankAccount[] = raw.bankAccounts ?? [];
  const bank = bankAccounts.find((b) => b.default) ?? bankAccounts[0];

  const pt: VendorPaymentTermsDetails | null =
    raw.paymentTerms && typeof raw.paymentTerms === 'object'
      ? raw.paymentTerms
      : null;

  return {
    id,
    name,
    email,
    address: raw.vendorAddress ?? raw.address,
    website: raw.website,
    city: raw.city,
    state: raw.state,
    pincode: raw.pinCode ?? raw.pincode,
    country: raw.country,
    type: raw.type as VendorType | undefined,
    status: raw.status as VendorStatus | undefined,
    notes: raw.notes,

    contactPerson: contact?.contactPerson ?? raw.contactPerson,
    phone: contact?.phone ?? raw.phone,
    alternatePhone: contact?.alternatePhone ?? raw.alternatePhone,

    gstNumber: taxIds.find((t) => t.type === 'GST')?.value ?? raw.gstNumber,
    panNumber: taxIds.find((t) => t.type === 'PAN')?.value ?? raw.panNumber,

    bankName: bank?.bankName ?? raw.bankName,
    accountNumber: bank?.accountNumber ?? raw.accountNumber,
    ifscCode: bank?.ifscCode ?? raw.ifscCode,
    accountHolderName: bank?.accountHolderName ?? raw.accountHolderName,
    swift: bank?.swift ?? raw.swift,

    paymentTerms: pt?.paymentTerms as PaymentTerms | undefined,
    creditLimit: pt?.creditLimit ?? raw.creditLimit,
    creditDays: pt?.creditDays ?? raw.creditDays,

    totalPurchaseValue: raw.totalPurchaseValue,
    totalPaid: raw.totalPaid,
    totalOutstanding: raw.totalOutstanding,
    lastPaymentDate: parseUTCDate(raw.lastPaymentDate) ?? undefined,
    lastPaymentAmount: raw.lastPaymentAmount,
    totalOrders: raw.totalOrders,
    pendingOrders: raw.pendingOrders,
    completedOrders: raw.completedOrders,
    cancelledOrders: raw.cancelledOrders,
    attachments: raw.attachments,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    updatedAt: parseUTCDate(raw.updatedAt) ?? undefined,
  };
}
