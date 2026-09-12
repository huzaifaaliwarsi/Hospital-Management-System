import React from 'react';
import { History, Shield, Clock, User, CheckCircle2 } from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface ProfileAuditSectionProps {
  profile: HospitalProfile;
}

export const ProfileAuditSection: React.FC<ProfileAuditSectionProps> = ({ profile }) => {
  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e2eae5]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Profile Information & Audit Trace</h3>
            <p className="text-[11px] text-[#52665e]">
              Record governance metadata, profile lifecycle timeline, and accountability audit stamps.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-[#08775A] bg-[#effaf5] px-2.5 py-1 rounded-full border border-[#c2e7db] flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-[#149e75]" />
          <span>Audit Logging Active</span>
        </span>
      </div>

      {/* Grid of Audit Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
        {/* Profile Status */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Profile Status
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-bold text-[#111827]">{profile.status}</span>
          </div>
        </div>

        {/* Created On */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Created On
          </span>
          <div className="flex items-center gap-1.5 mt-1 font-mono text-[#111827] font-semibold">
            <Clock className="h-3.5 w-3.5 text-[#149e75]" />
            <span>{profile.createdAt}</span>
          </div>
        </div>

        {/* Created By */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Created By
          </span>
          <div className="flex items-center gap-1.5 mt-1 text-[#111827] font-semibold">
            <User className="h-3.5 w-3.5 text-[#149e75]" />
            <span>{profile.createdBy}</span>
          </div>
        </div>

        {/* Updated On */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Updated On
          </span>
          <div className="flex items-center gap-1.5 mt-1 font-mono text-[#08775A] font-bold">
            <Clock className="h-3.5 w-3.5 text-[#149e75]" />
            <span>{profile.updatedAt || 'Not configured'}</span>
          </div>
        </div>

        {/* Updated By */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Updated By
          </span>
          <div className="flex items-center gap-1.5 mt-1 text-[#111827] font-semibold">
            <User className="h-3.5 w-3.5 text-[#149e75]" />
            <span>{profile.updatedBy || 'Not configured'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
