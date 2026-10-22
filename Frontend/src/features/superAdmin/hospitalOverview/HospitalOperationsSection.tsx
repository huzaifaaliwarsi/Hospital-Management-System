import React from 'react';
import {
  Clock,
  Calendar,
  Globe2,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  Edit3,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';
import { RoomChargeDayCloseSection } from './RoomChargeDayCloseSection';

interface HospitalOperationsSectionProps {
  profile: HospitalProfile;
  onEditProfile?: () => void;
}

export const HospitalOperationsSection: React.FC<HospitalOperationsSectionProps> = ({
  profile,
  onEditProfile,
}) => {
  // Check if standard OPD hours are uniformly configured
  const opdOpen = profile.opdOpenTime || '08:00 AM';
  const opdClose = profile.opdCloseTime || '08:00 PM';
  const hasUniformHours = Boolean(opdOpen && opdClose);

  // Calculate open days count
  const openDaysCount = profile.workingHours.filter((wh) => wh.isOpen).length;

  return (
    <div className="space-y-6">
      {/* 1. Primary Operating Model & Core Timings */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-6 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#08775A] flex items-center justify-center font-bold shrink-0 border border-emerald-100">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  Facility Operations & Clinical Timings
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#08775A] border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Operational
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hospital operating model, outpatient consultation shifts, casualty triage, and daily IPD census cycle.
              </p>
            </div>
          </div>

          {onEditProfile && (
            <button
              type="button"
              onClick={onEditProfile}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Configure Timings</span>
            </button>
          )}
        </div>

        {/* 4 Clean Strategic Metric Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Hospital Operational Mode */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Operating Mode
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="font-bold text-slate-900 text-sm mb-1 line-clamp-1">
              {profile.workingMode || 'Standard OPD & 24/7 Emergency'}
            </div>
            <p className="text-[11px] text-slate-500">
              {profile.emergencyEnabled !== false
                ? '24/7 Emergency triage, ICU, and casualty active'
                : 'Day-shift operational only'}
            </p>
          </div>

          {/* 2. Standard OPD Consultation Hours */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Outpatient (OPD) Hours
              </span>
              <Clock className="h-3.5 w-3.5 text-[#08775A]" />
            </div>
            <div className="font-bold text-slate-900 text-sm font-mono mb-1">
              {opdOpen} – {opdClose}
            </div>
            <p className="text-[11px] text-slate-500">
              Scheduled outpatient & specialist consultation window
            </p>
          </div>

          {/* 3. IPD Room / Bed Posting Time */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                IPD Bed Census Cut-Off
              </span>
              <Clock className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="font-bold text-slate-900 text-sm font-mono mb-1">
              {profile.ipdDailyRoomBedPostingTime || '12:00 PM'}
            </div>
            <p className="text-[11px] text-slate-500">
              Daily automated inpatient room posting cycle
            </p>
          </div>

          {/* 4. Timezone & Locale Format */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                System Timezone
              </span>
              <Globe2 className="h-3.5 w-3.5 text-[#08775A]" />
            </div>
            <div className="font-bold text-slate-900 text-sm truncate mb-1">
              {profile.timezone || 'Asia/Karachi'}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] text-slate-600">
              <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono">
                {profile.dateFormat || 'DD/MM/YYYY'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono">
                {profile.timeFormat || '12-Hour'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#08775A] border border-emerald-200 font-semibold font-mono">
                {profile.currency || 'PKR'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Weekly Outpatient Clinic Timetable (Redesigned clean, professional ERP view) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#08775A] flex items-center justify-center font-bold shrink-0 border border-emerald-100">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Weekly Outpatient Clinic Timetable
              </h4>
              <p className="text-xs text-slate-500">
                Operational schedule for general OPD and clinical specialty practices.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#08775A] border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{openDaysCount} Days Active / Week</span>
            </span>
          </div>
        </div>

        {/* Schedule Grid - 7 Beautifully Proportioned Day Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {profile.workingHours.map((wh) => {
            const hasHours = wh.isOpen && wh.openTime && wh.closeTime;
            const displayOpen = wh.openTime || opdOpen;
            const displayClose = wh.closeTime || opdClose;

            return (
              <div
                key={wh.day}
                className={`p-3.5 rounded-xl border transition-all ${
                  wh.isOpen
                    ? 'bg-emerald-50/40 border-emerald-200/80 shadow-2xs hover:border-emerald-300'
                    : 'bg-slate-50/60 border-slate-200/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    {wh.day}
                  </span>
                  {wh.isOpen ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                      Open
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200/70 text-slate-600">
                      Closed
                    </span>
                  )}
                </div>

                {wh.isOpen ? (
                  <div className="space-y-1">
                    <div className="text-[11px] font-mono font-semibold text-slate-900 bg-white/80 py-1 px-1.5 rounded border border-emerald-100 text-center">
                      {hasHours ? `${wh.openTime} – ${wh.closeTime}` : `${displayOpen} – ${displayClose}`}
                    </div>
                    <span className="block text-[10px] text-center text-slate-500 font-medium">
                      Standard OPD
                    </span>
                  </div>
                ) : (
                  <div className="py-2 text-center">
                    <span className="text-[11px] text-slate-400 font-medium italic">
                      No OPD Clinics
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 24/7 Casualty & Inpatient Continuity Banner */}
        <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#08775A] flex items-center justify-center shrink-0 border border-emerald-100">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">24/7 Continuity Protection: </span>
            Emergency Casualty, Triage, ICU, and Inpatient Admissions operate 24 hours a day, 7 days a week, regardless of outpatient clinic hours.
          </div>
        </div>
      </div>

      {/* 3. Inpatient Day-Close Accommodation Billing */}
      <RoomChargeDayCloseSection profile={profile} />
    </div>
  );
};
