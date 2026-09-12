import React from 'react';
import { Clock, CheckCircle2, Moon, Building2 } from 'lucide-react';
import { ShiftKPIs } from '../../../types/shift';

interface ShiftKPIBarProps {
  kpis: ShiftKPIs;
}

export const ShiftKPIBar: React.FC<ShiftKPIBarProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total Shifts */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Shifts
          </span>
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] border border-[#c2e7db] flex items-center justify-center">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-900 mt-2">
          {kpis.totalShifts}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Configured master duty shifts
        </p>
      </div>

      {/* 2. Active Shifts */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Shifts
          </span>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-emerald-700 mt-2">
          {kpis.activeShifts}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Available for staff assignment
        </p>
      </div>

      {/* 3. Overnight Shifts */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Overnight Shifts
          </span>
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
            <Moon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-indigo-700 mt-2">
          {kpis.overnightShifts}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Cross-midnight duty cycles (+1 Day)
        </p>
      </div>

      {/* 4. Departments Covered */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Departments Covered
          </span>
          <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
            <Building2 className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-amber-700 mt-2">
          {kpis.departmentsCovered}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Hospital departments with shifts
        </p>
      </div>
    </div>
  );
};
