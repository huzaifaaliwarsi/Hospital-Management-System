import React, { useState } from 'react';
import {
  Search,
  RotateCcw,
  Plus,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  PowerOff,
  Power,
  Filter,
} from 'lucide-react';
import { Ward, WardFilterState } from '../../../types/wardsRoomsBeds';
import { Department } from '../../../types/department';
import { VALID_WARD_TYPES } from '../../../services/wardsRoomsBedsService';

interface WardTabProps {
  wards: Ward[];
  departments: Department[];
  onAdd: () => void;
  onView: (ward: Ward) => void;
  onEdit: (ward: Ward) => void;
  onToggleStatus: (ward: Ward) => void;
  onDelete: (ward: Ward) => void;
}

export const WardTab: React.FC<WardTabProps> = ({
  wards,
  departments,
  onAdd,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
}) => {
  const [filters, setFilters] = useState<WardFilterState>({
    searchTerm: '',
    departmentId: 'All',
    wardType: 'All',
    status: 'All',
  });

  const filteredWards = wards.filter((w) => {
    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.toLowerCase().trim();
      const mCode = w.code.toLowerCase().includes(q);
      const mName = w.name.toLowerCase().includes(q);
      const mDept = w.departmentName.toLowerCase().includes(q);
      if (!mCode && !mName && !mDept) return false;
    }
    if (filters.departmentId !== 'All' && w.departmentId !== filters.departmentId)
      return false;
    if (filters.wardType !== 'All' && w.wardType !== filters.wardType) return false;
    if (filters.status !== 'All' && w.status !== filters.status) return false;
    return true;
  });

  const isFiltered =
    filters.searchTerm.trim() !== '' ||
    filters.departmentId !== 'All' ||
    filters.wardType !== 'All' ||
    filters.status !== 'All';

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      departmentId: 'All',
      wardType: 'All',
      status: 'All',
    });
  };

  return (
    <div id="ward-tab-content" className="space-y-4">
      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="ward-search-input"
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters((p) => ({ ...p, searchTerm: e.target.value }))}
              placeholder="Search by ward code, ward name, or department..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Department */}
            <select
              id="ward-filter-dept"
              aria-label="Filter by department"
              value={filters.departmentId}
              onChange={(e) => setFilters((p) => ({ ...p, departmentId: e.target.value }))}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code}) {d.status === 'Inactive' ? '(Inactive)' : ''}
                </option>
              ))}
            </select>

            {/* Ward Type */}
            <select
              id="ward-filter-type"
              aria-label="Filter by ward type"
              value={filters.wardType}
              onChange={(e) => setFilters((p) => ({ ...p, wardType: e.target.value as any }))}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">All Ward Types</option>
              {VALID_WARD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              id="ward-filter-status"
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as any }))}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>

            {isFiltered && (
              <button
                id="ward-reset-filters-btn"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}

            <button
              id="add-ward-btn"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Ward
            </button>
          </div>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Showing <strong className="text-slate-800 font-semibold">{filteredWards.length}</strong> of{' '}
              {wards.length} wards
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredWards.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#08775A] flex items-center justify-center mx-auto mb-3">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Wards Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            No inpatient wards match your filter selection. Try clearing filters or create a new ward.
          </p>
          <button
            onClick={resetFilters}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#08775A] bg-[#effaf5] border border-[#c2e7db] rounded-lg"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table id="wards-master-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Ward Code</th>
                  <th className="py-3 px-4">Ward Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Ward Type</th>
                  <th className="py-3 px-4">Floor / Location</th>
                  <th className="py-3 px-4 text-center">Rooms</th>
                  <th className="py-3 px-4 text-center">Total Beds</th>
                  <th className="py-3 px-4 text-center">Available Beds</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredWards.map((w) => {
                  const hasLinkedRoomsOrBeds =
                    (w.roomCount ?? 0) > 0 ||
                    (w.bedCount ?? 0) > 0 ||
                    (w.historicalAdmissionCount ?? 0) > 0;

                  return (
                    <tr
                      key={w.id}
                      id={`ward-row-${w.id}`}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {w.code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {w.name}
                        {w.genderPolicy && (
                          <span className="ml-2 text-[10px] text-slate-500 font-normal">
                            ({w.genderPolicy})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {w.departmentName}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {w.wardType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {w.location ? `${w.floor || ''} - ${w.location}` : w.floor || '—'}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">
                        {w.roomCount}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {w.bedCount}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                          {w.availableBeds ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {w.status === 'Active' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-[#effaf5] px-2 py-0.5 rounded-full border border-[#c2e7db]">
                            <CheckCircle2 className="w-3 h-3 text-[#08775A]" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`ward-view-btn-${w.id}`}
                            onClick={() => onView(w)}
                            title="View Ward Details"
                            className="p-1.5 text-slate-500 hover:text-[#08775A] hover:bg-[#effaf5] rounded-md transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`ward-edit-btn-${w.id}`}
                            onClick={() => onEdit(w)}
                            title="Edit Ward"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`ward-toggle-status-btn-${w.id}`}
                            onClick={() => onToggleStatus(w)}
                            title={w.status === 'Active' ? 'Deactivate Ward' : 'Activate Ward'}
                            className={`p-1.5 rounded-md transition-colors ${
                              w.status === 'Active'
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {w.status === 'Active' ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            id={`ward-delete-btn-${w.id}`}
                            onClick={() => onDelete(w)}
                            title={
                              hasLinkedRoomsOrBeds
                                ? `Cannot delete: contains ${w.roomCount} room(s) and ${w.bedCount} bed(s)`
                                : 'Delete Ward'
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              hasLinkedRoomsOrBeds
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
