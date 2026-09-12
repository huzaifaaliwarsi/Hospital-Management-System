import React from 'react';
import {
  FileText,
  Receipt,
  FileCheck2,
  Building,
  Phone,
  Mail,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface HospitalBillingSectionProps {
  profile: HospitalProfile;
}

export const HospitalBillingSection: React.FC<HospitalBillingSectionProps> = ({ profile }) => {
  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);

  // Address for invoice branding preview
  const invoiceAddress = isConfigured(profile.billingAddress)
    ? profile.billingAddress
    : [profile.addressLine1, profile.city, profile.country].filter(Boolean).join(', ') || null;

  const invoicePhone = profile.invoicePhone || profile.primaryPhone || null;
  const invoiceEmail = profile.invoiceEmail || profile.primaryEmail || null;

  return (
    <div className="space-y-4">
      {/* Billing & Legal Information Form/View */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e2eae5]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Billing & Legal Information</h3>
              <p className="text-[11px] text-[#52665e]">
                Corporate registration, tax identifiers (NTN/STRN), billing contact details, and invoice prefixes.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Legal Business Name */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Legal Business Name
            </span>
            {isConfigured(profile.legalBusinessName) ? (
              <span className="font-semibold text-[#111827] mt-1 block">
                {profile.legalBusinessName}
              </span>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>

          {/* Tax / NTN Number */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Tax / NTN Number
            </span>
            {isConfigured(profile.taxNumber) ? (
              <span className="font-mono font-semibold text-[#111827] mt-1 block">
                {profile.taxNumber}
              </span>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>

          {/* Sales Tax / Registration Number */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Sales Tax / Registration Number (STRN)
            </span>
            {isConfigured(profile.salesTaxNumber) ? (
              <span className="font-mono font-semibold text-[#111827] mt-1 block">
                {profile.salesTaxNumber}
              </span>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>

          {/* Billing Address */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5] sm:col-span-2 lg:col-span-1">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Official Billing Address
            </span>
            {isConfigured(profile.billingAddress) ? (
              <span className="font-semibold text-[#111827] mt-1 block">
                {profile.billingAddress}
              </span>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>

          {/* Invoice Contact Number */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Invoice Billing Contact Phone
            </span>
            {isConfigured(profile.invoicePhone) ? (
              <a
                href={`tel:${profile.invoicePhone}`}
                className="font-semibold text-[#111827] hover:text-[#08775A] transition-colors mt-1 block"
              >
                {profile.invoicePhone}
              </a>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>

          {/* Invoice Email */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Invoice Billing Email
            </span>
            {isConfigured(profile.invoiceEmail) ? (
              <a
                href={`mailto:${profile.invoiceEmail}`}
                className="font-semibold text-[#111827] hover:text-[#08775A] transition-colors mt-1 block truncate"
              >
                {profile.invoiceEmail}
              </a>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>

          {/* Default Invoice Prefix */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Default Invoice Prefix
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono font-bold text-sm text-[#08775A] px-2 py-0.5 rounded bg-[#effaf5] border border-[#c2e7db]">
                {profile.invoicePrefix || 'INV'}
              </span>
              <span className="text-[11px] text-[#52665e]">(e.g. {profile.invoicePrefix || 'INV'}-2026-0001)</span>
            </div>
          </div>

          {/* Default Receipt Prefix */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Default Receipt Prefix
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono font-bold text-sm text-[#08775A] px-2 py-0.5 rounded bg-[#effaf5] border border-[#c2e7db]">
                {profile.receiptPrefix || 'REC'}
              </span>
              <span className="text-[11px] text-[#52665e]">(e.g. {profile.receiptPrefix || 'REC'}-2026-0001)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice / Receipt Branding Preview */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-[#e2eae5] gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                Billing Document Identity
              </h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                Read-Only Preview
              </span>
            </div>
            <p className="text-[11px] text-[#52665e] mt-0.5">
              Conceptual representation of how the hospital profile appears on official printed invoices, receipts, and clinical bills.
            </p>
          </div>
        </div>

        {/* Mock Invoice Document Card */}
        <div className="max-w-2xl mx-auto rounded-xl border border-[#c2e7db] bg-white p-5 shadow-xs">
          {/* Header of Invoice */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#e2eae5]">
            {/* Hospital Brand */}
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                {profile.logo ? (
                  <img
                    src={profile.logo}
                    alt="Logo"
                    className="h-12 w-12 object-contain rounded-lg border border-[#c2e7db] p-1"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-[#effaf5] border border-[#c2e7db] flex flex-col items-center justify-center text-[#08775A] font-bold">
                    <span className="text-sm font-extrabold leading-none">CSS</span>
                    <span className="text-[8px] font-semibold text-[#149e75]">HMS</span>
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <h5 className="text-sm font-bold text-[#111827]">{profile.name}</h5>
                <div className="text-[11px] text-[#52665e] flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#149e75] shrink-0" />
                  <span>{invoiceAddress || <em className="text-[#8b9e95]">Address: Not configured</em>}</span>
                </div>
                <div className="text-[11px] text-[#52665e] flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-[#149e75] shrink-0" />
                    <span>{invoicePhone || <em className="text-[#8b9e95]">Phone: Not configured</em>}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-[#149e75] shrink-0" />
                    <span>{invoiceEmail || <em className="text-[#8b9e95]">Email: Not configured</em>}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Document Number Badges */}
            <div className="flex sm:flex-col items-end gap-1.5 shrink-0">
              <div className="text-right">
                <span className="block text-[9px] uppercase font-bold text-[#8b9e95]">Sample Invoice</span>
                <span className="font-mono font-bold text-xs text-[#08775A] bg-[#effaf5] px-2 py-0.5 rounded border border-[#c2e7db]">
                  {profile.invoicePrefix || 'INV'}-2026-0001
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[9px] uppercase font-bold text-[#8b9e95]">Sample Receipt</span>
                <span className="font-mono font-bold text-xs text-[#111827] bg-[#f6faf8] px-2 py-0.5 rounded border border-[#e2eae5]">
                  {profile.receiptPrefix || 'REC'}-2026-0001
                </span>
              </div>
            </div>
          </div>

          {/* Legal / NTN Footer Bar */}
          <div className="pt-3 flex flex-wrap items-center justify-between text-[10px] text-[#52665e] gap-2">
            <span>
              <strong>Legal Entity:</strong> {profile.legalBusinessName || <em className="text-[#8b9e95]">Not configured</em>}
            </span>
            <span>
              <strong>NTN:</strong> {profile.taxNumber || <em className="text-[#8b9e95]">Not configured</em>}
            </span>
            <span>
              <strong>Currency:</strong> {profile.currency || 'PKR'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
