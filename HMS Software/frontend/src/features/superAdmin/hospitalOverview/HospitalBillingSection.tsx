import React from 'react';
import { FileText } from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface HospitalBillingSectionProps {
  profile: HospitalProfile;
  onNavigateToDiscounts?: () => void;
}

export const HospitalBillingSection: React.FC<HospitalBillingSectionProps> = ({
  profile,
  onNavigateToDiscounts,
}) => {
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

          {/* Front Desk Discount Governance */}
          <div className="p-3.5 rounded-lg bg-[#effaf5] border border-[#c2e7db] sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="block text-[10px] uppercase font-bold text-[#08775A]">
                Front Desk Discount Governance
              </span>
              <div className="flex items-center gap-2 mt-1 text-xs text-[#111827] flex-wrap">
                <span>
                  Max Threshold:{' '}
                  <strong>
                    {profile.discountMaxPercentThreshold !== undefined
                      ? `${profile.discountMaxPercentThreshold}%`
                      : '15%'}
                  </strong>{' '}
                  or{' '}
                  <strong>
                    Rs.{' '}
                    {(profile.discountMaxAmountThreshold ?? 1500).toLocaleString()}
                  </strong>
                </span>
                <span className="text-[#c2e7db]">•</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  Admin Approval:{' '}
                  {profile.discountApprovalRequired !== false ? (
                    <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                      Required above threshold
                    </span>
                  ) : (
                    <span className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                      Not Required (Direct discounts allowed)
                    </span>
                  )}
                </span>
                <span className="text-[#c2e7db]">•</span>
                <span>
                  Hospital Discounts:{' '}
                  <strong>
                    {profile.discountOverallAllowed !== false ? 'Enabled' : 'Disabled'}
                  </strong>
                </span>
              </div>
            </div>

            {onNavigateToDiscounts && (
              <button
                type="button"
                onClick={onNavigateToDiscounts}
                className="px-3 py-1.5 rounded-lg bg-[#08775A] hover:bg-[#065b44] text-white text-xs font-semibold cursor-pointer shrink-0 transition-colors"
              >
                Manage Discounts & Rates →
              </button>
            )}
          </div>
        </div>
      </div>
  );
};


