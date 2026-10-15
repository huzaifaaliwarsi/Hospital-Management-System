import React, { useState, useEffect } from 'react';
import {
  Edit3,
  Printer,
  ShieldCheck,
  Building2,
  FileCheck2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { HospitalProfile, DEFAULT_HOSPITAL_PROFILE, HospitalSystemAggregateCounts } from '../../types/hospital';
import { fetchHospitalProfile, saveHospitalProfile } from '../../services/hospitalProfileService';
import { getHospitalSystemSummaryAggregates } from '../../mocks/hospitalSummaryMock';
import { useToast } from '../../context/ToastContext';
import { HospitalProfileSummaryCard } from './hospitalOverview/HospitalProfileSummaryCard';
import { HospitalIdentitySection } from './hospitalOverview/HospitalIdentitySection';
import { HospitalContactSection } from './hospitalOverview/HospitalContactSection';
import { HospitalAddressSection } from './hospitalOverview/HospitalAddressSection';
import { HospitalOperationsSection } from './hospitalOverview/HospitalOperationsSection';
import { RoomChargeDayCloseSection } from './hospitalOverview/RoomChargeDayCloseSection';
import { BiometricDeviceSection } from './hospitalOverview/BiometricDeviceSection';
import { HospitalBillingSection } from './hospitalOverview/HospitalBillingSection';
import { HospitalSystemSummarySection } from './hospitalOverview/HospitalSystemSummarySection';
import { ProfileAuditSection } from './hospitalOverview/ProfileAuditSection';
import { DangerZoneSection } from './hospitalOverview/DangerZoneSection';
import { EditHospitalProfileModal } from './hospitalOverview/EditHospitalProfileModal';
import { PrintHospitalProfileModal } from './hospitalOverview/PrintHospitalProfileModal';
import { ResetDataModal } from './hospitalOverview/ResetDataModal';
import { FloorService } from '../../services/floorService';
import { HospitalFloor } from '../../types/department';
import { ManageFloorsModal } from './departments/ManageFloorsModal';

export const SuperAdminHospitalOverview: React.FC = () => {
  const toast = useToast();
  const [profile, setProfile] = useState<HospitalProfile>(DEFAULT_HOSPITAL_PROFILE);
  const [aggregates, setAggregates] = useState<HospitalSystemAggregateCounts | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [floors, setFloors] = useState<HospitalFloor[]>([]);
  const [isManageFloorsOpen, setIsManageFloorsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'identity' | 'operations' | 'biometric' | 'floors' | 'system'>('identity');

  const loadProfile = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [profileData, aggregatesData, floorsData] = await Promise.all([
        fetchHospitalProfile(),
        getHospitalSystemSummaryAggregates(),
        FloorService.fetchFloors().catch(() => []),
      ]);
      setProfile(profileData);
      setAggregates(aggregatesData);
      setFloors(floorsData);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load hospital profile from the server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = async (updatedProfile: HospitalProfile) => {
    const saved = await saveHospitalProfile(updatedProfile);
    setProfile(saved);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#52665e] gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading hospital profile…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button
          type="button"
          onClick={loadProfile}
          className="px-4 py-2 bg-[#129b70] hover:bg-[#08775A] text-white text-xs font-semibold rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

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
            Institutional identity, operational schedules, building infrastructure, and hardware terminal settings.
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
            <span>Print Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#129b70] hover:bg-[#08775A] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Edit3 className="h-4 w-4" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Master Hospital Profile Summary Card */}
      <HospitalProfileSummaryCard profile={profile} />

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/90 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('identity')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'identity'
              ? 'bg-white text-[#08775A] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Building2 className="w-4 h-4 text-[#149e75]" />
          <span>Identity & Location</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'operations'
              ? 'bg-white text-[#08775A] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-[#149e75]" />
          <span>Operations & Schedules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('biometric')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'biometric'
              ? 'bg-white text-[#08775A] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Biometric Terminal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('floors')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'floors'
              ? 'bg-white text-[#08775A] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Building2 className="w-4 h-4 text-[#149e75]" />
          <span>Floors & Facility</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#08775A]">
            {floors.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'system'
              ? 'bg-white text-[#08775A] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#149e75]" />
          <span>System & Maintenance</span>
        </button>
      </div>

      {/* Tab 1: Identity & Location */}
      {activeTab === 'identity' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <HospitalIdentitySection profile={profile} />
            <HospitalContactSection profile={profile} />
          </div>
          <HospitalAddressSection profile={profile} />
          <HospitalBillingSection profile={profile} />
        </div>
      )}

      {/* Tab 2: Operations & Schedules */}
      {activeTab === 'operations' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <HospitalOperationsSection profile={profile} />
          <RoomChargeDayCloseSection profile={profile} />
        </div>
      )}

      {/* Tab 3: Biometric Terminal Settings */}
      {activeTab === 'biometric' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <BiometricDeviceSection />
        </div>
      )}

      {/* Tab 4: Hospital Floors & Infrastructure */}
      {activeTab === 'floors' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#08775A] flex items-center justify-center font-bold shrink-0 border border-[#c2e7db]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800">
                      Hospital Floors &amp; Building Infrastructure
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {floors.length} {floors.length === 1 ? 'Floor' : 'Floors'} Configured
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                    Define building levels and medical floors. Configured active floors dynamically populate location selectors across Departments and Wards.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageFloorsOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#129b70] hover:bg-[#08775A] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Manage Floors</span>
              </button>
            </div>

            {/* Floor Badges List */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
              {floors.map((fl) => (
                <span
                  key={fl.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{fl.name}</span>
                  {fl.building && (
                    <span className="text-[10px] text-slate-400 font-normal">({fl.building})</span>
                  )}
                </span>
              ))}
              {floors.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  No hospital floors configured yet. Click &quot;Manage Floors&quot; to define building levels.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: System & Maintenance */}
      {activeTab === 'system' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <HospitalSystemSummarySection aggregates={aggregates} />
          <ProfileAuditSection profile={profile} />
          <DangerZoneSection onOpenResetModal={() => setIsResetModalOpen(true)} />
        </div>
      )}

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

      {/* Reset Test Data Modal */}
      <ResetDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onResetSuccess={loadProfile}
      />

      {/* Manage Hospital Floors Modal */}
      <ManageFloorsModal
        isOpen={isManageFloorsOpen}
        onClose={() => setIsManageFloorsOpen(false)}
        onFloorsUpdated={(updatedFloors) => {
          setFloors(updatedFloors);
        }}
      />
    </div>
  );
};
