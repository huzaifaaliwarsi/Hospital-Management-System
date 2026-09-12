import React from 'react';
import { Search, RotateCcw, Filter } from 'lucide-react';
import {
  StaffUserFilterState,
  STAFF_CATEGORIES,
  STAFF_PORTALS,
  STAFF_PORTAL_ROLES,
  StaffCategory,
  StaffPortalKey,
  StaffStatus,
  StaffAccessType,
} from '../../../types/staffUser';
import { Department } from '../../../types/department';

interface StaffUsersFilterBarProps {
  filters: StaffUserFilterState;
  onFilterChange: (newFilters: StaffUserFilterState) => void;
  departments: Department[];
  totalMatches: number;
  totalRecords: number;
}

export const StaffUsersFilterBar: React.FC<StaffUsersFilterBarProps> = ({
  filters,
  onFilterChange,
  departments,
  totalMatches,
  totalRecords,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, searchTerm: e.target.value });
  };

  const handleSelectChange = (
    key: keyof StaffUserFilterState,
    value: string
  ) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handlePortalFilterChange = (value: string) => {
    onFilterChange({
      ...filters,
      assignedPortal: value,
      staffRole: 'ALL', // reset role when portal changes
    });
  };

  const availableRoles =
    filters.assignedPortal && filters.assignedPortal !== 'ALL'
      ? STAFF_PORTAL_ROLES[filters.assignedPortal as StaffPortalKey] || []
      : Array.from(new Set(Object.values(STAFF_PORTAL_ROLES).flat()));

  const handleReset = () => {
    onFilterChange({
      searchTerm: '',
      departmentId: 'ALL',
      staffCategory: 'ALL',
      accessType: 'ALL',
      assignedPortal: 'ALL',
      status: 'ALL',
      staffRole: 'ALL',
    });
  };

  const isFiltered =
    filters.searchTerm.trim() !== '' ||
    filters.departmentId !== 'ALL' ||
    filters.staffCategory !== 'ALL' ||
    filters.accessType !== 'ALL' ||
    filters.assignedPortal !== 'ALL' ||
    filters.status !== 'ALL' ||
    (filters.staffRole && filters.staffRole !== 'ALL');

  return (
    <div className="bg-white border border-[#e2eae5] rounded-xl p-4 shadow-sm mb-6 space-y-3.5">
      {/* Search and Quick Counter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b9e95]" />
          <input
            type="text"
            value={filters.searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by Employee Code, Name, Phone, Email, CNIC, Designation, Dept, Username..."
            className="w-full pl-9 pr-4 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-sm text-[#111827] placeholder-[#8b9e95] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70] transition-colors"
          />
          {filters.searchTerm && (
            <button
              onClick={() => onFilterChange({ ...filters, searchTerm: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8b9e95] hover:text-[#111827] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[#52665e] font-medium bg-[#f6f8f7] px-3 py-2 rounded-lg border border-[#e2eae5]">
            Showing <strong className="text-[#111827]">{totalMatches}</strong> of{' '}
            <strong className="text-[#111827]">{totalRecords}</strong> staff
          </span>

          {isFiltered && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0e7d5a] bg-[#e7f6f1] hover:bg-[#d0efe5] border border-[#c2e7db] rounded-lg transition-colors cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Structured Filter Dropdowns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 border-t border-[#e2eae5]/60">
        {/* Department */}
        <div>
          <label className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider mb-1">
            Department
          </label>
          <select
            value={filters.departmentId}
            onChange={(e) => handleSelectChange('departmentId', e.target.value)}
            className="w-full py-1.5 px-2.5 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        {/* Staff Category */}
        <div>
          <label className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider mb-1">
            Staff Category
          </label>
          <select
            value={filters.staffCategory}
            onChange={(e) => handleSelectChange('staffCategory', e.target.value)}
            className="w-full py-1.5 px-2.5 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
          >
            <option value="ALL">All Categories</option>
            {STAFF_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Access Type */}
        <div>
          <label className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider mb-1">
            Access Type
          </label>
          <select
            value={filters.accessType}
            onChange={(e) => handleSelectChange('accessType', e.target.value)}
            className="w-full py-1.5 px-2.5 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
          >
            <option value="ALL">All Access Types</option>
            <option value="PORTAL_USER">Portal User (Login Enabled)</option>
            <option value="STAFF_RECORD_ONLY">Staff Record Only (Directory)</option>
          </select>
        </div>

        {/* Assigned Portal */}
        <div>
          <label className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider mb-1">
            Assigned Portal
          </label>
          <select
            value={filters.assignedPortal}
            onChange={(e) => handlePortalFilterChange(e.target.value)}
            className="w-full py-1.5 px-2.5 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
          >
            <option value="ALL">All Portals</option>
            {STAFF_PORTALS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Staff Role */}
        <div>
          <label className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider mb-1">
            Staff Role
          </label>
          <select
            value={filters.staffRole || 'ALL'}
            onChange={(e) => handleSelectChange('staffRole', e.target.value)}
            className="w-full py-1.5 px-2.5 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
          >
            <option value="ALL">All Roles</option>
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider mb-1">
            Account Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleSelectChange('status', e.target.value)}
            className="w-full py-1.5 px-2.5 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>
    </div>
  );
};
