import React from 'react';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  PhoneCall,
  Hash,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface HospitalEssentialDetailsCardProps {
  profile: HospitalProfile;
  onNavigateToDiscounts?: () => void;
  onEditProfile?: () => void;
}

export const HospitalEssentialDetailsCard: React.FC<HospitalEssentialDetailsCardProps> = ({
  profile,
  onNavigateToDiscounts,
  onEditProfile,
}) => {
  const displayVal = (val?: string | null) => {
    if (val && val.trim().length > 0) {
      return <span className="font-semibold text-slate-900">{val}</span>;
    }
    return <span className="text-slate-400 font-normal select-none">—</span>;
  };

  const fullLocation = [
    profile.addressLine1,
    profile.city,
    profile.province,
    profile.country || 'Pakistan',
  ]
    .filter((p) => p && p.trim().length > 0)
    .join(', ');

  return (
    <div className="space-y-6">
      {/* ── 1. Clean Hospital Identity & Contact Directory ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-[#08775A] border border-[#c2e7db] flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hospital Information &amp; Contact Lines</h3>
              <p className="text-xs text-slate-500">
                Core institutional identity, slip header names, reception desks, and physical facility address.
              </p>
            </div>
          </div>

          {onEditProfile && (
            <button
              type="button"
              onClick={onEditProfile}
              className="text-xs font-semibold text-[#08775A] hover:text-[#065b44] hover:underline cursor-pointer inline-flex items-center gap-1 shrink-0"
            >
              <span>Edit Details</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Essential 2-Column Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5 text-xs">
          {/* Hospital Legal Name */}
          <div className="space-y-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Hospital Legal Name</span>
            </span>
            <div className="text-sm font-bold text-slate-900">{profile.name}</div>
          </div>

          {/* Short Name / Receipt Header */}
          <div className="space-y-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-slate-400" />
              <span>Short Name (Slips &amp; Invoices)</span>
            </span>
            <div>
              {profile.shortName && profile.shortName.trim().length > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-[#08775A] border border-[#c2e7db] font-bold text-xs">
                  {profile.shortName}
                </span>
              ) : (
                displayVal(profile.shortName)
              )}
            </div>
          </div>

          {/* Hospital Type */}
          <div className="space-y-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              <span>Hospital Category</span>
            </span>
            <div>{displayVal(profile.hospitalType || 'General Hospital')}</div>
          </div>

          {/* NTN / Tax ID */}
          <div className="space-y-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>National Tax Number (NTN)</span>
            </span>
            <div className="font-mono">{displayVal(profile.taxNumber)}</div>
          </div>

          {/* Primary Phone */}
          <div className="space-y-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              <span>Reception / Primary Phone</span>
            </span>
            <div>
              {profile.primaryPhone && profile.primaryPhone.trim().length > 0 ? (
                <a
                  href={`tel:${profile.primaryPhone}`}
                  className="font-semibold text-slate-900 hover:text-[#08775A] transition-colors"
                >
                  {profile.primaryPhone}
                </a>
              ) : (
                displayVal(null)
              )}
            </div>
          </div>

          {/* 24/7 Emergency Hotline */}
          <div className="space-y-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <PhoneCall className="h-3.5 w-3.5 text-rose-500" />
              <span>24/7 Emergency Helpline</span>
            </span>
            <div>
              {profile.emergencyPhone && profile.emergencyPhone.trim().length > 0 ? (
                <a
                  href={`tel:${profile.emergencyPhone}`}
                  className="font-bold text-rose-700 hover:text-rose-900 transition-colors"
                >
                  {profile.emergencyPhone}
                </a>
              ) : (
                displayVal(profile.primaryPhone)
              )}
            </div>
          </div>

          {/* Official Email */}
          <div className="space-y-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              <span>Official Email</span>
            </span>
            <div>
              {profile.primaryEmail && profile.primaryEmail.trim().length > 0 ? (
                <a
                  href={`mailto:${profile.primaryEmail}`}
                  className="font-semibold text-slate-900 hover:text-[#08775A] transition-colors"
                >
                  {profile.primaryEmail}
                </a>
              ) : (
                displayVal(null)
              )}
            </div>
          </div>

          {/* Facility Location / Address */}
          <div className="space-y-1 md:col-span-2">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>Physical Campus Address</span>
            </span>
            <div>
              {fullLocation ? (
                <span className="font-semibold text-slate-900">{fullLocation}</span>
              ) : (
                displayVal(null)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Front Desk Discount Governance Strip ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#08775A]" />
            <span className="font-bold text-xs text-[#08775A] uppercase tracking-wider">
              Front Desk Discount Policy
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
            <span>
              Max Cashier Limit:{' '}
              <strong className="text-slate-900 font-bold">
                {profile.discountMaxPercentThreshold ?? 15}% or Rs. {(profile.discountMaxAmountThreshold ?? 1500).toLocaleString()}
              </strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Admin Approval:{' '}
              <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                {profile.discountApprovalRequired !== false ? 'Required above threshold' : 'Direct Allowed'}
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Status:{' '}
              <span className="font-semibold text-emerald-700">
                {profile.discountOverallAllowed !== false ? 'Enabled' : 'Disabled'}
              </span>
            </span>
          </div>
        </div>

        {onNavigateToDiscounts && (
          <button
            type="button"
            onClick={onNavigateToDiscounts}
            className="px-4 py-2.5 rounded-xl bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
          >
            <span>Manage Discounts &amp; Rates</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
