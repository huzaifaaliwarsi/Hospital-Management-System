import React from 'react';
import { Search, RotateCcw, Filter, X } from 'lucide-react';
import { AdminUserFilterState, AdminUserRole, AdminUserStatus } from '../../../types/adminUser';

interface AdminUsersFilterBarProps {
  filters: AdminUserFilterState;
  onFilterChange: (filters: AdminUserFilterState) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export const AdminUsersFilterBar: React.FC<AdminUsersFilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  totalCount,
  filteredCount,
}) => {
  const isFiltered =
    filters.searchTerm.trim() !== '' ||
    filters.role !== 'ALL' ||
    filters.status !== 'ALL';

  return (
    <div
      id="admin-users-filter-bar"
      className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-3"
    >
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="admin-users-search-input"
            type="text"
            placeholder="Search by name, username, email, phone, user ID or employee code..."
            value={filters.searchTerm}
            onChange={(e) =>
              onFilterChange({ ...filters, searchTerm: e.target.value })
            }
            className="w-full text-xs pl-9 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75] focus:border-transparent bg-slate-50/60 placeholder:text-slate-400"
          />
          {filters.searchTerm && (
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, searchTerm: '' })}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Role:
            </span>
            <select
              id="admin-users-role-filter"
              value={filters.role}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  role: e.target.value as 'ALL' | AdminUserRole,
                })
              }
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Status:
            </span>
            <select
              id="admin-users-status-filter"
              value={filters.status}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  status: e.target.value as 'ALL' | AdminUserStatus,
                })
              }
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              id="admin-users-reset-filters-btn"
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Status Feedback */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3 w-3 text-slate-400" />
          <span>
            Showing <strong className="text-slate-800 font-semibold">{filteredCount}</strong> of{' '}
            <strong className="text-slate-800 font-semibold">{totalCount}</strong> administrative records
          </span>
          {isFiltered && (
            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-[#08775A] border border-[#c2e7db] text-[10px] font-semibold">
              Filters Active
            </span>
          )}
        </div>
        <div className="hidden sm:block text-slate-400">
          Logical matching applied across all filters
        </div>
      </div>
    </div>
  );
};
