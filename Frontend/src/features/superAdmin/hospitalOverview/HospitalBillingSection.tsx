import React from 'react';
import { FileText } from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface HospitalBillingSectionProps {
  profile: HospitalProfile;
}

export const HospitalBillingSection: React.FC<HospitalBillingSectionProps> = ({ profile }) => {
  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);

  return (
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
  );
};

