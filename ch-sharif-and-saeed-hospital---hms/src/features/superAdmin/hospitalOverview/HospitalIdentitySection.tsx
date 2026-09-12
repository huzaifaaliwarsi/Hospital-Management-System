import React from 'react';
import { Building, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface HospitalIdentitySectionProps {
  profile: HospitalProfile;
}

export const HospitalIdentitySection: React.FC<HospitalIdentitySectionProps> = ({ profile }) => {
  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);

  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e2eae5]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
            <Building className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Hospital Identity</h3>
            <p className="text-[11px] text-[#52665e]">
              Institutional registration, legal nomenclature, hospital classification, and licensing.
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
            profile.status === 'Active'
              ? 'bg-[#effaf5] text-[#08775A] border-[#c2e7db]'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {profile.status === 'Active' ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Operational: Active</span>
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5 text-rose-600" />
              <span>Operational: Inactive</span>
            </>
          )}
        </span>
      </div>

      {/* Grid of Identity Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {/* Hospital Logo Status */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5] flex items-center gap-3">
          <div className="shrink-0">
            {profile.logo ? (
              <img
                src={profile.logo}
                alt="Hospital Logo"
                className="h-10 w-10 object-contain rounded-lg border border-[#c2e7db] bg-white p-1"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white border border-[#c2e7db] flex items-center justify-center text-[#08775A] font-bold text-xs">
                CSS
              </div>
            )}
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Hospital Logo
            </span>
            <span className="font-semibold text-[#111827]">
              {profile.logo ? 'Custom Logo Configured' : 'Default Monogram (CSS)'}
            </span>
          </div>
        </div>

        {/* Hospital Name */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Hospital Name
          </span>
          <span className="font-bold text-[#111827] text-sm">
            {profile.name}
          </span>
        </div>

        {/* Short Name / Display Name */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Short Name / Display Name
          </span>
          {isConfigured(profile.shortName) ? (
            <span className="font-semibold text-[#111827]">{profile.shortName}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Hospital Type */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Hospital Type
          </span>
          {isConfigured(profile.hospitalType) ? (
            <span className="font-semibold text-[#111827]">{profile.hospitalType}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Registration Number */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Registration Number
          </span>
          {isConfigured(profile.registrationNumber) ? (
            <span className="font-mono font-semibold text-[#111827]">{profile.registrationNumber}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* License Number */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            License Number
          </span>
          {isConfigured(profile.licenseNumber) ? (
            <span className="font-mono font-semibold text-[#111827]">{profile.licenseNumber}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Accreditation Body */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Accreditation Body
          </span>
          {isConfigured(profile.accreditationBody) ? (
            <span className="font-semibold text-[#08775A] flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{profile.accreditationBody}</span>
            </span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Accreditation Number */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Accreditation Number
          </span>
          {isConfigured(profile.accreditationNumber) ? (
            <span className="font-mono font-semibold text-[#111827]">{profile.accreditationNumber}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Operational Status */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Hospital Status
          </span>
          <span
            className={`font-semibold inline-flex items-center gap-1 ${
              profile.status === 'Active' ? 'text-[#08775A]' : 'text-rose-600'
            }`}
          >
            {profile.status}
          </span>
        </div>
      </div>
    </div>
  );
};
