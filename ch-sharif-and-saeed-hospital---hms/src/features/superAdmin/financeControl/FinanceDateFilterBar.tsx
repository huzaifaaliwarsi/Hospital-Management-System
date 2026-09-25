import React from 'react';
import { RotateCcw, Calendar, Filter } from 'lucide-react';
import { Select, TextInput } from '../../../components/forms/FormControls';
import { formatDateISO, getHospitalCurrentDate } from '../../../utils/dateConstants';
import type { DatePreset } from '../../../services/financeControlService';

const PRESET_OPTIONS: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Custom Range', value: 'custom' },
];

interface FinanceDateFilterBarProps {
  preset: DatePreset;
  onPresetChange: (p: DatePreset) => void;
  fromDate: string;
  toDate: string;
  onFromDateChange: (v: string) => void;
  onToDateChange: (v: string) => void;
  onRefresh: () => void;
  children?: React.ReactNode;
}

/** Consistent reporting filter bar for Finance Control screens */
export const FinanceDateFilterBar: React.FC<FinanceDateFilterBarProps> = ({
  preset,
  onPresetChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onRefresh,
  children,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col md:flex-row md:items-end justify-between gap-3 flex-wrap">
      <div className="flex items-end gap-3 flex-wrap flex-1">
        <div className="w-52">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#08775A]" />
            Audit Period
          </label>
          <Select
            options={PRESET_OPTIONS}
            value={preset}
            onChange={(e) => onPresetChange(e.target.value as DatePreset)}
          />
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-38">
              <TextInput
                label="From"
                lang="en-GB"
                type="date"
                value={fromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
              />
            </div>
            <div className="w-38">
              <TextInput
                label="To"
                lang="en-GB"
                type="date"
                value={toDate}
                onChange={(e) => onToDateChange(e.target.value)}
              />
            </div>
          </div>
        )}

        {children}
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto pt-1 md:pt-0">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
          title="Reload latest records"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[#08775A]" />
          <span>Refresh Data</span>
        </button>
      </div>
    </div>
  );
};

export function todayISO() {
  return formatDateISO(getHospitalCurrentDate());
}
