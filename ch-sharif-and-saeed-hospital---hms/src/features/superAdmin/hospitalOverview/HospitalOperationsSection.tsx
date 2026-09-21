import React from 'react';
import {
  Sliders,
  Clock,
  Calendar,
  DollarSign,
  Globe2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface HospitalOperationsSectionProps {
  profile: HospitalProfile;
}

export const HospitalOperationsSection: React.FC<HospitalOperationsSectionProps> = ({ profile }) => {
  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);

  return (
    <div className="space-y-4">
      {/* General Operational Parameters */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e2eae5]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Operational Settings</h3>
              <p className="text-[11px] text-[#52665e]">
                Default currency, system timezone, calendar convention, OPD operating hours, and casualty triage.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Default Currency */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Default Currency
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="h-5 w-5 rounded bg-[#effaf5] text-[#08775A] flex items-center justify-center font-bold text-xs border border-[#c2e7db]">
                ₨
              </span>
              <span className="font-bold text-[#08775A] font-mono text-sm">
                {profile.currency || 'PKR'}
              </span>
              <span className="text-[11px] text-[#52665e]">(Pakistani Rupee)</span>
            </div>
          </div>

          {/* Timezone */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              System Timezone
            </span>
            <span className="font-semibold text-[#111827] mt-1 flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5 text-[#149e75]" />
              <span>{profile.timezone || 'UTC+05:00 (Pakistan Standard Time)'}</span>
            </span>
          </div>

          {/* Week Start Day */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Week Start Day
            </span>
            <span className="font-semibold text-[#111827] mt-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#149e75]" />
              <span>{profile.weekStartDay || 'Monday'}</span>
            </span>
          </div>

          {/* Hospital Working Mode */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Hospital Working Mode
            </span>
            <div className="mt-1">
              {isConfigured(profile.workingMode) ? (
                <span className="font-semibold text-[#111827] block">
                  {profile.workingMode}
                </span>
              ) : (
                <span className="text-[#8b9e95] italic font-normal block">
                  Not configured
                </span>
              )}
            </div>
          </div>

          {/* OPD Opening & Closing Time */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Standard OPD Consultation Hours
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#149e75]" />
              {isConfigured(profile.opdOpenTime) && isConfigured(profile.opdCloseTime) ? (
                <span className="font-semibold text-[#111827]">
                  {profile.opdOpenTime} – {profile.opdCloseTime}
                </span>
              ) : (
                <span className="text-[#8b9e95] italic font-normal">Not configured</span>
              )}
            </div>
          </div>

          {/* Hospital Day Close Time */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Day Close Time
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#149e75]" />
              {isConfigured(profile.dayCloseTime) ? (
                <span className="font-semibold text-[#111827]">{profile.dayCloseTime}</span>
              ) : (
                <span className="text-[#8b9e95] italic font-normal">Not configured</span>
              )}
            </div>
          </div>

          {/* Emergency Service Availability */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Emergency Availability
            </span>
            <div className="mt-1 flex items-center gap-2">
              {profile.emergencyEnabled ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>Enabled</span>
                  </span>
                  {profile.emergencyMode && (
                    <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                      {profile.emergencyMode}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[#8b9e95] italic font-normal text-xs">
                  Not configured
                </span>
              )}
            </div>
          </div>

          {/* Date Format */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Default Date Format
            </span>
            <span className="font-mono font-semibold text-[#111827] mt-1 block">
              {profile.dateFormat || 'DD/MM/YYYY'}
            </span>
          </div>

          {/* Time Format */}
          <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
              Default Time Format
            </span>
            <span className="font-mono font-semibold text-[#111827] mt-1 block">
              {profile.timeFormat || '12-Hour (hh:mm A)'}
            </span>
          </div>
        </div>
      </div>

      {/* Working Hours Compact Table */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-[#e2eae5] gap-2">
          <div>
            <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
              Working Hours (OPD & Specialty Clinics)
            </h4>
            <p className="text-[11px] text-[#52665e]">
              Weekly timetable for outpatient clinics.
            </p>
          </div>
          {profile.emergencyEnabled && profile.emergencyMode === '24/7' ? (
            <span className="text-[10px] font-semibold text-[#08775A] bg-[#effaf5] px-2.5 py-1 rounded-md border border-[#c2e7db] self-start sm:self-auto">
              Emergency 24/7 Active
            </span>
          ) : profile.emergencyEnabled && profile.emergencyMode ? (
            <span className="text-[10px] font-semibold text-[#08775A] bg-[#effaf5] px-2.5 py-1 rounded-md border border-[#c2e7db] self-start sm:self-auto">
              Emergency: {profile.emergencyMode}
            </span>
          ) : (
            <span className="text-[10px] text-[#8b9e95] bg-[#f6faf8] px-2.5 py-1 rounded-md border border-[#e2eae5] self-start sm:self-auto italic font-normal">
              Not configured
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {profile.workingHours.map((wh) => {
            const hasHours = wh.isOpen && wh.openTime && wh.closeTime;
            return (
              <div
                key={wh.day}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  hasHours
                    ? 'bg-[#effaf5] border-[#c2e7db]'
                    : wh.isOpen
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-[#f8faf9] border-[#e2eae5]'
                }`}
              >
                <span className="block text-[11px] font-bold text-[#111827] mb-1">
                  {wh.day}
                </span>

                {wh.isOpen ? (
                  hasHours ? (
                    <div>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#d6f0e4] text-[#08775A] mb-1">
                        Open
                      </span>
                      <span className="block text-[11px] font-mono text-[#111827] font-semibold">
                        {wh.openTime}
                      </span>
                      <span className="block text-[10px] text-[#52665e]">to</span>
                      <span className="block text-[11px] font-mono text-[#111827] font-semibold">
                        {wh.closeTime}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 mb-1">
                        Open
                      </span>
                      <span className="block text-[11px] text-[#8b9e95] italic">
                        Not configured
                      </span>
                    </div>
                  )
                ) : (
                  <div>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 mb-1">
                      Closed
                    </span>
                    <span className="block text-[11px] text-[#8b9e95] italic">
                      No OPD Clinics
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
