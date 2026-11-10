import React from 'react';
import { MapPin } from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface HospitalAddressSectionProps {
  profile: HospitalProfile;
}

export const HospitalAddressSection: React.FC<HospitalAddressSectionProps> = ({ profile }) => {
  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);

  // Computed summary
  const addressParts = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.province,
    profile.postalCode,
    profile.country,
  ].filter((p) => p && p.trim().length > 0);

  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e2eae5]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Address & Location</h3>
            <p className="text-[11px] text-[#52665e]">
              Physical hospital facility campus, municipal zoning, postal code, and country location.
            </p>
          </div>
        </div>
      </div>

      {/* Formatted Full Address Banner if configured */}
      {addressParts.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-[#effaf5] border border-[#c2e7db] flex items-start gap-2.5 text-xs">
          <MapPin className="h-4 w-4 text-[#08775A] shrink-0 mt-0.5" />
          <div>
            <span className="block text-[10px] uppercase font-bold text-[#08775A]">
              Consolidated Campus Location
            </span>
            <span className="font-semibold text-[#111827]">
              {addressParts.join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Grid of Address Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {/* Address Line 1 */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Address Line 1
          </span>
          {isConfigured(profile.addressLine1) ? (
            <span className="font-semibold text-[#111827] mt-1 block">{profile.addressLine1}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
          )}
        </div>

        {/* Address Line 2 */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Address Line 2 (Optional)
          </span>
          {isConfigured(profile.addressLine2) ? (
            <span className="font-semibold text-[#111827] mt-1 block">{profile.addressLine2}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
          )}
        </div>

        {/* City */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            City
          </span>
          {isConfigured(profile.city) ? (
            <span className="font-semibold text-[#111827] mt-1 block">{profile.city}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
          )}
        </div>

        {/* Province / State */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Province / State
          </span>
          {isConfigured(profile.province) ? (
            <span className="font-semibold text-[#111827] mt-1 block">{profile.province}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
          )}
        </div>

        {/* Postal Code */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Postal Code
          </span>
          {isConfigured(profile.postalCode) ? (
            <span className="font-mono font-semibold text-[#111827] mt-1 block">{profile.postalCode}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
          )}
        </div>

        {/* Country */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Country
          </span>
          <span className="font-semibold text-[#111827] mt-1 block">
            {profile.country || 'Pakistan'}
          </span>
        </div>
      </div>
    </div>
  );
};
