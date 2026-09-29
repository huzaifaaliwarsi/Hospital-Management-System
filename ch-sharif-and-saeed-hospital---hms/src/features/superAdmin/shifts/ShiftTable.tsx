import React from 'react';
import {
  Eye,
  Edit2,
  Copy,
  Power,
  RotateCcw,
  Clock,
  Plus,
  Moon,
  Sun,
  Sunrise,
  Sparkles,
  SearchX,
} from 'lucide-react';
import { Shift, ShiftType } from '../../../types/shift';
import {
  format12HourTime,
  formatMinutesToHours,
} from '../../../services/shiftService';

interface ShiftTableProps {
  shifts: Shift[];
  totalCount: number;
  onView: (shift: Shift) => void;
  onEdit: (shift: Shift) => void;
  onDuplicate: (shift: Shift) => void;
  onToggleStatus: (shift: Shift) => void;
  onAddNew: () => void;
  onClearFilters: () => void;
}

const renderShiftTypeBadge = (type: ShiftType) => {
  switch (type) {
    case 'MORNING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
          <Sunrise className="h-2.5 w-2.5" />
          Morning
        </span>
      );
    case 'EVENING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <Sun className="h-2.5 w-2.5" />
          Evening
        </span>
      );
    case 'NIGHT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
          <Moon className="h-2.5 w-2.5" />
          Night
        </span>
      );
    case 'CUSTOM':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <Sparkles className="h-2.5 w-2.5" />
          Custom
        </span>
      );
  }
};

export const ShiftTable: React.FC<ShiftTableProps> = ({
  shifts,
  totalCount,
  onView,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onAddNew,
  onClearFilters,
}) => {
  // 1. Completely Empty Dataset (First time load or no shifts configured)
  if (totalCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="h-14 w-14 rounded-full bg-[#effaf5] text-[#08775A] border border-[#c2e7db] flex items-center justify-center mx-auto mb-4">
          <Clock className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          No Duty Shifts Configured
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
          The hospital operates 24/7. Configure departmental master duty shifts
          with customizable working hours, arrival tolerances, and weekly off schedules.
        </p>

        {/* Informative Helper Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 max-w-md mx-auto mt-4 text-left">
          <span className="text-[11px] font-semibold text-slate-700 block mb-1">
            Common Hospital Shift Formats:
          </span>
          <ul className="text-[11px] text-slate-500 space-y-1 list-disc list-inside">
            <li><strong>Morning Shift:</strong> 08:00 AM – 04:00 PM (8h gross, 30m break)</li>
            <li><strong>Evening Shift:</strong> 04:00 PM – 12:00 AM (8h gross, 30m break)</li>
            <li><strong>Night Shift:</strong> 08:00 PM – 08:00 AM (+1 Day / Overnight, 12h gross)</li>
          </ul>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Shift</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Filtered Out Results
  if (shifts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-xs">
        <SearchX className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <h4 className="text-sm font-bold text-slate-800">
          No matching shifts found
        </h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          No configured shifts match your active search and filter combinations.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 px-3 py-1.5 text-xs font-semibold text-[#08775A] bg-[#effaf5] hover:bg-[#d8f3e7] border border-[#c2e7db] rounded-lg transition-colors cursor-pointer"
        >
          Clear Active Filters
        </button>
      </div>
    );
  }

  // 3. Regular Table View
  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#f1f5f9] border-b border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-wider select-none sticky top-0 z-10">
              <th className="py-2.5 px-3 text-center border-r border-slate-300 w-12">#</th>
              <th className="py-2.5 px-3.5 border-r border-slate-300">Shift Code</th>
              <th className="py-2.5 px-3.5 border-r border-slate-300">Shift Name</th>
              <th className="py-2.5 px-3.5 border-r border-slate-300">Department</th>
              <th className="py-2.5 px-3 border-r border-slate-300">Type</th>
              <th className="py-2.5 px-3.5 border-r border-slate-300">Timing</th>
              <th className="py-2.5 px-3 border-r border-slate-300">Net Hours</th>
              <th className="py-2.5 px-2.5 border-r border-slate-300">Break</th>
              <th className="py-2.5 px-3 border-r border-slate-300">Default Grace</th>
              <th className="py-2.5 px-3 border-r border-slate-300">Weekly Off</th>
              <th className="py-2.5 px-3 border-r border-slate-300">Status</th>
              <th className="py-2.5 px-3.5 border-r border-slate-300">Updated By</th>
              <th className="py-2.5 px-3.5 border-r border-slate-300">Updated Date</th>
              <th className="py-2.5 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {shifts.map((shift, idx) => (
              <tr
                key={shift.id}
                className="hover:bg-slate-50/90 transition-colors group border-b border-slate-200"
              >
                {/* 0. Index # */}
                <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/60 whitespace-nowrap">
                  {idx + 1}
                </td>

                {/* 1. Shift Code */}
                <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap border-r border-slate-200">
                  {shift.code}
                </td>

                {/* 2. Shift Name */}
                <td className="py-2.5 px-3.5 font-semibold text-slate-900 whitespace-nowrap border-r border-slate-200">
                  {shift.name}
                </td>

                {/* 3. Department */}
                <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap border-r border-slate-200">
                  <span className="font-medium">{shift.departmentName}</span>
                </td>

                {/* 4. Type */}
                <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">
                  {renderShiftTypeBadge(shift.shiftType)}
                </td>

                {/* 5. Timing */}
                <td className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-200">
                  <div className="font-medium text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
                    <span>{format12HourTime(shift.startTime)}</span>
                    <span className="text-slate-400">–</span>
                    <span>{format12HourTime(shift.endTime)}</span>
                    {shift.isOvernight && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Moon className="h-2.5 w-2.5" />
                        Overnight
                      </span>
                    )}
                  </div>
                </td>

                {/* 6. Net Working Hours */}
                <td className="py-2.5 px-3 whitespace-nowrap font-bold text-[#08775A] border-r border-slate-200 font-mono">
                  {formatMinutesToHours(shift.netWorkingMinutes)}
                </td>

                {/* 7. Break */}
                <td className="py-2.5 px-2.5 whitespace-nowrap text-slate-600 border-r border-slate-200 font-mono">
                  {shift.breakMinutes > 0 ? `${shift.breakMinutes}m` : '0m'}
                </td>

                {/* 8. Default Grace */}
                <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 text-[11px] border-r border-slate-200">
                  <span>{shift.defaultArrivalGraceMinutes}m in / {shift.defaultEarlyExitToleranceMinutes}m out</span>
                </td>

                {/* 9. Weekly Off */}
                <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-600 border-r border-slate-200">
                  {shift.defaultWeeklyOffDays && shift.defaultWeeklyOffDays.length > 0 ? (
                    <span
                      title={shift.defaultWeeklyOffDays.join(', ')}
                      className="inline-block max-w-[130px] truncate"
                    >
                      {shift.defaultWeeklyOffDays.join(', ')}
                    </span>
                  ) : (
                    <span className="text-slate-400">None (24/7)</span>
                  )}
                </td>

                {/* 10. Status */}
                <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      shift.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {shift.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                </td>

                {/* 11. Updated By */}
                <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-700 font-medium border-r border-slate-200 max-w-[130px] truncate" title={shift.updatedByName}>
                  {shift.updatedByName || '—'}
                </td>

                {/* 12. Updated Date */}
                <td className="py-2.5 px-3.5 whitespace-nowrap text-[11px] text-slate-500 border-r border-slate-200">
                  {shift.updatedAt || '—'}
                </td>

                {/* 13. Actions */}
                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => onView(shift)}
                      className="p-1 hover:bg-slate-100 text-slate-500 hover:text-[#08775A] rounded transition-colors cursor-pointer"
                      title="View Shift Details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => onEdit(shift)}
                      className="p-1 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors cursor-pointer"
                      title="Edit Shift"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={() => onDuplicate(shift)}
                      className="p-1 hover:bg-slate-100 text-slate-500 hover:text-amber-600 rounded transition-colors cursor-pointer"
                      title="Duplicate Shift"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>

                    {/* Toggle Status: Deactivate / Reactivate (No hard delete!) */}
                    <button
                      type="button"
                      onClick={() => onToggleStatus(shift)}
                      className={`p-1 hover:bg-slate-100 rounded transition-colors cursor-pointer ${
                        shift.status === 'ACTIVE'
                          ? 'text-slate-400 hover:text-rose-600'
                          : 'text-slate-400 hover:text-emerald-600'
                      }`}
                      title={shift.status === 'ACTIVE' ? 'Deactivate Shift' : 'Reactivate Shift'}
                    >
                      {shift.status === 'ACTIVE' ? (
                        <Power className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
