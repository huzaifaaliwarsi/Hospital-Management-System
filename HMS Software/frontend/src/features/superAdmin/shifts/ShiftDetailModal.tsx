import React from 'react';
import {
  X,
  Clock,
  Building2,
  Calendar,
  ShieldCheck,
  Moon,
  Sun,
  FileText,
  UserCheck,
} from 'lucide-react';
import { Shift } from '../../../types/shift';
import {
  format12HourTime,
  formatMinutesToHours,
} from '../../../services/shiftService';

interface ShiftDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift | null;
}

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({
  isOpen,
  onClose,
  shift,
}) => {
  if (!isOpen || !shift) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#effaf5] text-[#08775A] border border-[#c2e7db] flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                  {shift.code}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    shift.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {shift.status === 'ACTIVE' ? 'Active Shift' : 'Inactive Shift'}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                {shift.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-5 text-xs">
          {/* 1. Core Shift Parameters */}
          <div className="grid grid-cols-2 gap-3.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Department
              </span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span>{shift.departmentName}</span>
              </div>
            </div>

            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Shift Type
              </span>
              <span className="font-semibold text-slate-800">
                {shift.shiftType} Shift
              </span>
            </div>

            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Duty Hours (Start – End)
              </span>
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <span>{format12HourTime(shift.startTime)}</span>
                <span className="text-slate-400">–</span>
                <span>{format12HourTime(shift.endTime)}</span>
              </div>
              {shift.isOvernight && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-1">
                  <Moon className="h-2.5 w-2.5" />
                  Crosses Midnight (+1 Day)
                </span>
              )}
            </div>

            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Net Working Hours
              </span>
              <div className="text-sm font-bold text-[#08775A]">
                {formatMinutesToHours(shift.netWorkingMinutes)}
              </div>
              <div className="text-[10px] text-slate-400">
                Gross: {formatMinutesToHours(shift.grossDurationMinutes)} | Break: {shift.breakMinutes}m
              </div>
            </div>
          </div>

          {/* 2. Attendance & Schedule Timing Policies */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#08775A]" />
              Schedule & Attendance Defaults
            </h3>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-slate-500 block text-[11px]">Arrival Grace Period:</span>
                <span className="font-semibold text-slate-900">
                  {shift.defaultArrivalGraceMinutes} minutes
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Early Exit Tolerance:</span>
                <span className="font-semibold text-slate-900">
                  {shift.defaultEarlyExitToleranceMinutes} minutes
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-500 block text-[11px] mb-1.5">Default Weekly Off:</span>
              {shift.defaultWeeklyOffDays && shift.defaultWeeklyOffDays.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {shift.defaultWeeklyOffDays.map((day) => (
                    <span
                      key={day}
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]"
                    >
                      {day}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 italic">
                  No default off day assigned (24/7 continuous / rotational roster).
                </span>
              )}
            </div>
          </div>

          {/* 3. Operational Notes (if any) */}
          {shift.notes && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Operational Notes
              </div>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                {shift.notes}
              </p>
            </div>
          )}

          {/* 4. Complete Human Accountability Audit Trail */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#08775A]" />
              Accountability Audit Trail
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-600 pt-1">
              {/* Created By */}
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Created By
                </span>
                <div className="font-semibold text-slate-800">
                  {shift.createdByName} ({shift.createdByRole})
                </div>
                <div className="text-slate-400 font-mono text-[10px]">
                  ID: {shift.createdByUserId} • {shift.createdAt}
                </div>
              </div>

              {/* Last Updated By */}
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Last Updated By
                </span>
                <div className="font-semibold text-slate-800">
                  {shift.updatedByName} ({shift.updatedByRole})
                </div>
                <div className="text-slate-400 font-mono text-[10px]">
                  ID: {shift.updatedByUserId} • {shift.updatedAt}
                </div>
              </div>
            </div>

            {/* Status Changed By (if applicable) */}
            {shift.statusChangedByName && (
              <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Status Modified By
                </span>
                <div className="font-semibold text-slate-800">
                  {shift.statusChangedByName} at {shift.statusChangedAt}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-end bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
