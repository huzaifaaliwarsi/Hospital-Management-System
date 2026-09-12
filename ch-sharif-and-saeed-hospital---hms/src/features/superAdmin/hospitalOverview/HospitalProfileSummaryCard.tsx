import React from 'react';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface HospitalProfileSummaryCardProps {
  profile: HospitalProfile;
}

export const HospitalProfileSummaryCard: React.FC<HospitalProfileSummaryCardProps> = ({ profile }) => {
  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);

  // Format full address if available
  const addressParts = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.province,
    profile.country,
  ].filter((p) => p && p.trim().length > 0);
  const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] shadow-2xs overflow-hidden">
      {/* Top Banner with light mint & emerald styling */}
      <div className="bg-gradient-to-r from-[#effaf5] via-white to-[#effaf5] p-6 border-b border-[#e2eae5]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Identity & Logo */}
          <div className="flex items-start sm:items-center gap-4">
            {/* Hospital Logo or CSS Monogram */}
            <div className="shrink-0">
              {profile.logo ? (
                <div className="h-16 w-16 rounded-xl border border-[#c2e7db] bg-white p-1.5 shadow-2xs flex items-center justify-center overflow-hidden">
                  <img
                    src={profile.logo}
                    alt={profile.name}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-[#effaf5] to-[#d6f0e4] border border-[#c2e7db] flex flex-col items-center justify-center text-[#08775A] shadow-xs select-none">
                  <span className="text-lg font-extrabold tracking-wider leading-none">CSS</span>
                  <span className="text-[9px] font-bold text-[#149e75] tracking-widest mt-0.5">HMS</span>
                </div>
              )}
            </div>

            {/* Title & Metadata */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                  <Building2 className="h-3 w-3 text-[#149e75]" />
                  <span>Hospital Management System</span>
                </span>

                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    profile.status === 'Active'
                      ? 'bg-[#effaf5] text-[#08775A] border-[#c2e7db]'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {profile.status === 'Active' ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
                      <span>Active</span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <span>Inactive</span>
                    </>
                  )}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111827]">
                {profile.name}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#52665e]">
                <span>
                  <strong className="font-semibold text-slate-700">Short Name:</strong>{' '}
                  {isConfigured(profile.shortName) ? (
                    <span className="text-[#111827] font-medium">{profile.shortName}</span>
                  ) : (
                    <span className="text-[#8b9e95] italic">Not configured</span>
                  )}
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  <strong className="font-semibold text-slate-700">Hospital Type:</strong>{' '}
                  {isConfigured(profile.hospitalType) ? (
                    <span className="text-[#111827] font-medium">{profile.hospitalType}</span>
                  ) : (
                    <span className="text-[#8b9e95] italic">Not configured</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Status Pillbox */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-[#e2eae5] shadow-xs shrink-0 sm:min-w-[280px]">
            <div>
              <span className="block text-[10px] text-[#8b9e95] uppercase font-bold tracking-wider">
                Default Currency
              </span>
              <span className="font-bold text-[#08775A] font-mono text-sm">
                {profile.currency || 'PKR'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-[#8b9e95] uppercase font-bold tracking-wider">
                Emergency Service
              </span>
              {profile.emergencyEnabled && profile.emergencyMode && profile.emergencyMode.trim().length > 0 ? (
                <span className="font-bold text-[#111827] text-xs flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>{profile.emergencyMode}</span>
                </span>
              ) : profile.emergencyEnabled ? (
                <span className="font-bold text-[#111827] text-xs flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Enabled</span>
                </span>
              ) : (
                <span className="text-[#8b9e95] italic font-normal text-xs block mt-0.5">
                  Not configured
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Contact & Location Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#e2eae5] p-4 text-xs bg-[#f6faf8]">
        {/* Contact Phone */}
        <div className="flex items-center gap-3 p-2">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0 border border-[#c2e7db]">
            <Phone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95] tracking-wider">
              Primary Contact
            </span>
            {isConfigured(profile.primaryPhone) ? (
              <a
                href={`tel:${profile.primaryPhone}`}
                className="text-[#111827] font-medium hover:text-[#08775A] transition-colors truncate block"
              >
                {profile.primaryPhone}
              </a>
            ) : (
              <span className="text-[#8b9e95] italic">Not configured</span>
            )}
          </div>
        </div>

        {/* Admin Email */}
        <div className="flex items-center gap-3 p-2">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0 border border-[#c2e7db]">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95] tracking-wider">
              Administrative Email
            </span>
            {isConfigured(profile.primaryEmail) ? (
              <a
                href={`mailto:${profile.primaryEmail}`}
                className="text-[#111827] font-medium hover:text-[#08775A] transition-colors truncate block"
              >
                {profile.primaryEmail}
              </a>
            ) : (
              <span className="text-[#8b9e95] italic">Not configured</span>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="flex items-center gap-3 p-2">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0 border border-[#c2e7db]">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95] tracking-wider">
              Physical Address
            </span>
            {formattedAddress ? (
              <span className="text-[#111827] font-medium line-clamp-1">
                {formattedAddress}
              </span>
            ) : (
              <span className="text-[#8b9e95] italic">Not configured</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
