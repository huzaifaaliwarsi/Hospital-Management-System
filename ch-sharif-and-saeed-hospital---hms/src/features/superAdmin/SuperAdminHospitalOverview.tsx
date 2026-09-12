import React, { useState, useEffect } from 'react';
import {
  Edit3,
  Printer,
  ShieldCheck,
  Building2,
  FileCheck2,
} from 'lucide-react';
import { HospitalProfile } from '../../types/hospital';
import {
  HOSPITAL_PROFILE_STORAGE_KEY,
  getHospitalProfile,
} from '../../services/hospitalProfileService';
import { HospitalProfileSummaryCard } from './hospitalOverview/HospitalProfileSummaryCard';
import { HospitalIdentitySection } from './hospitalOverview/HospitalIdentitySection';
import { HospitalContactSection } from './hospitalOverview/HospitalContactSection';
import { HospitalAddressSection } from './hospitalOverview/HospitalAddressSection';
import { HospitalOperationsSection } from './hospitalOverview/HospitalOperationsSection';
import { HospitalBillingSection } from './hospitalOverview/HospitalBillingSection';
import { HospitalSystemSummarySection } from './hospitalOverview/HospitalSystemSummarySection';
import { ProfileAuditSection } from './hospitalOverview/ProfileAuditSection';
import { EditHospitalProfileModal } from './hospitalOverview/EditHospitalProfileModal';
import { PrintHospitalProfileModal } from './hospitalOverview/PrintHospitalProfileModal';

export const SuperAdminHospitalOverview: React.FC = () => {
  // Initialize state with persistence in localStorage if available
  const [profile, setProfile] = useState<HospitalProfile>(() => getHospitalProfile());

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Save to localStorage whenever profile changes
  useEffect(() => {
    try {
      localStorage.setItem(HOSPITAL_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }, [profile]);

  const handleSaveProfile = (updatedProfile: HospitalProfile) => {
    setProfile(updatedProfile);
  };

  // Only display accreditation badge if explicitly configured
  const hasAccreditation = Boolean(
    profile.accreditationBody && profile.accreditationBody.trim().length > 0
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2eae5]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111827]">
              Hospital Overview
            </h1>
            {hasAccreditation && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{profile.accreditationBody}</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#52665e]">
            Manage hospital identity, contact information, operational settings and billing profile.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-[#f6faf8] text-[#52665e] hover:text-[#111827] border border-[#e2eae5] text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="h-4 w-4 text-[#149e75]" />
            <span>Print Hospital Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#129b70] hover:bg-[#08775A] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Edit3 className="h-4 w-4" />
            <span>Edit Hospital Profile</span>
          </button>
        </div>
      </div>

      {/* Hospital Profile Summary Card */}
      <HospitalProfileSummaryCard profile={profile} />

      {/* Section 1: Hospital Identity */}
      <HospitalIdentitySection profile={profile} />

      {/* Section 2: Contact Information */}
      <HospitalContactSection profile={profile} />

      {/* Section 3: Address & Location */}
      <HospitalAddressSection profile={profile} />

      {/* Section 4: Operational Settings & Working Hours */}
      <HospitalOperationsSection profile={profile} />

      {/* Section 5: Billing & Legal Information + Document Identity Preview */}
      <HospitalBillingSection profile={profile} />

      {/* Section 6: Hospital System Summary */}
      <HospitalSystemSummarySection />

      {/* Section 7: Profile Information & Audit Trace */}
      <ProfileAuditSection profile={profile} />

      {/* Edit Hospital Profile Modal */}
      <EditHospitalProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
        onSave={handleSaveProfile}
      />

      {/* Print Hospital Profile Modal */}
      <PrintHospitalProfileModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        profile={profile}
      />
    </div>
  );
};
