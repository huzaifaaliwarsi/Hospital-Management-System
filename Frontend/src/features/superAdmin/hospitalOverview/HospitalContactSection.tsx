import React from 'react';
import {
  Phone,
  Mail,
  Globe,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface HospitalContactSectionProps {
  profile: HospitalProfile;
}

export const HospitalContactSection: React.FC<HospitalContactSectionProps> = ({ profile }) => {
  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);

  const normalizeUrl = (url: string) => {
    if (!url) return '';
    return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  };

  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e2eae5]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
            <Phone className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Contact Information</h3>
            <p className="text-[11px] text-[#52665e]">
              Official public board lines, emergency hotlines, administrative emails, and web portal.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Contact Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {/* Primary Phone */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5] flex flex-col justify-between">
          <div>
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Primary Phone
            </span>
            {isConfigured(profile.primaryPhone) ? (
              <a
                href={`tel:${profile.primaryPhone}`}
                className="font-semibold text-[#111827] hover:text-[#08775A] transition-colors flex items-center gap-1.5 mt-1"
              >
                <Phone className="h-3.5 w-3.5 text-[#149e75]" />
                <span>{profile.primaryPhone}</span>
              </a>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>
          <span className="text-[10px] text-[#8b9e95] mt-2">Main Hospital Reception</span>
        </div>

        {/* Alternate Phone */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5] flex flex-col justify-between">
          <div>
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Alternate Phone
            </span>
            {isConfigured(profile.alternatePhone) ? (
              <a
                href={`tel:${profile.alternatePhone}`}
                className="font-semibold text-[#111827] hover:text-[#08775A] transition-colors flex items-center gap-1.5 mt-1"
              >
                <Phone className="h-3.5 w-3.5 text-[#149e75]" />
                <span>{profile.alternatePhone}</span>
              </a>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>
          <span className="text-[10px] text-[#8b9e95] mt-2">Secondary Line / Operator</span>
        </div>

        {/* Emergency Contact Number */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5] flex flex-col justify-between">
          <div>
            <span className="block text-[10px] uppercase font-bold text-rose-700">
              Emergency Contact Number
            </span>
            {isConfigured(profile.emergencyPhone) ? (
              <a
                href={`tel:${profile.emergencyPhone}`}
                className="font-bold text-rose-700 hover:text-rose-800 transition-colors flex items-center gap-1.5 mt-1"
              >
                <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                <span>{profile.emergencyPhone}</span>
              </a>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>
          <span className="text-[10px] text-rose-600/80 mt-2 font-medium">24/7 Casualty & Triage Dispatch</span>
        </div>

        {/* Administrative Email */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5] flex flex-col justify-between">
          <div>
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Administrative Email
            </span>
            {isConfigured(profile.primaryEmail) ? (
              <a
                href={`mailto:${profile.primaryEmail}`}
                className="font-semibold text-[#111827] hover:text-[#08775A] transition-colors flex items-center gap-1.5 mt-1 truncate"
              >
                <Mail className="h-3.5 w-3.5 text-[#149e75] shrink-0" />
                <span className="truncate">{profile.primaryEmail}</span>
              </a>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>
          <span className="text-[10px] text-[#8b9e95] mt-2">Executive Inquiries</span>
        </div>

        {/* Secondary Email */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5] flex flex-col justify-between">
          <div>
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Secondary Email
            </span>
            {isConfigured(profile.secondaryEmail) ? (
              <a
                href={`mailto:${profile.secondaryEmail}`}
                className="font-semibold text-[#111827] hover:text-[#08775A] transition-colors flex items-center gap-1.5 mt-1 truncate"
              >
                <Mail className="h-3.5 w-3.5 text-[#149e75] shrink-0" />
                <span className="truncate">{profile.secondaryEmail}</span>
              </a>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>
          <span className="text-[10px] text-[#8b9e95] mt-2">Operational / Support Desk</span>
        </div>

        {/* Website */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5] flex flex-col justify-between">
          <div>
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Website
            </span>
            {isConfigured(profile.website) ? (
              <a
                href={normalizeUrl(profile.website)}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#08775A] hover:underline flex items-center gap-1.5 mt-1 truncate"
              >
                <Globe className="h-3.5 w-3.5 text-[#149e75] shrink-0" />
                <span className="truncate">{profile.website}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <span className="text-[#8b9e95] italic font-normal mt-1 block">Not configured</span>
            )}
          </div>
          <span className="text-[10px] text-[#8b9e95] mt-2">Official Patient Portal Domain</span>
        </div>
      </div>
    </div>
  );
};
