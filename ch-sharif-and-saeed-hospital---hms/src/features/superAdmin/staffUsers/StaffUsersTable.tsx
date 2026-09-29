import React, { useState } from 'react';
import {
  Eye,
  Edit2,
  KeyRound,
  ShieldPlus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown,
  UserCheck,
  Stethoscope,
  Wallet,
} from 'lucide-react';
import { StaffUser } from '../../../types/staffUser';
import { StaffUserService } from '../../../services/staffUserService';
import { formatDateTimeDDMMYYYY } from '../../../utils/formatters';

interface StaffUsersTableProps {
  staffList: StaffUser[];
  onView: (staff: StaffUser) => void;
  onEdit: (staff: StaffUser) => void;
  onResetPassword: (staff: StaffUser) => void;
  onClinicalAuth: (staff: StaffUser) => void;
  onSalaryProfile: (staff: StaffUser) => void;
  onPortalAccess: (staff: StaffUser) => void;
  onOpenStatusModal: (staff: StaffUser, targetStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => void;
  onDelete: (staff: StaffUser) => void;
}

export const StaffUsersTable: React.FC<StaffUsersTableProps> = ({
  staffList,
  onView,
  onEdit,
  onResetPassword,
  onClinicalAuth,
  onSalaryProfile,
  onPortalAccess,
  onOpenStatusModal,
  onDelete,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortField, setSortField] = useState<keyof StaffUser>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Sorting
  const sortedList = [...staffList].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field: keyof StaffUser) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedList = sortedList.slice(startIndex, startIndex + pageSize);

  const getStatusBadge = (status: StaffUser['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#e7f6f1] text-[#0e7d5a] border border-[#c2e7db]">
            <CheckCircle className="h-3 w-3 text-[#129b70]" />
            Active
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <XCircle className="h-3 w-3 text-gray-500" />
            Inactive
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            Suspended
          </span>
        );
    }
  };

  const getPortalBadge = (user: StaffUser) => {
    if (user.accessType === 'STAFF_RECORD_ONLY') {
      if (StaffUserService.isPortalEligible(user.staffCategory)) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            Portal Access Required
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <UserCheck className="h-3 w-3 text-slate-500" />
          Staff Record Only
        </span>
      );
    }

    switch (user.assignedPortal) {
      case 'front-desk':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Front Desk & Billing
          </span>
        );
      case 'admission':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Admission
          </span>
        );
      case 'inventory':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            Inventory
          </span>
        );
      default:
        return <span className="text-xs text-[#8b9e95]">—</span>;
    }
  };

  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden flex flex-col">
      <div className="overflow-x-auto min-h-[380px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#f1f5f9] border-b border-slate-300 text-slate-800 font-bold uppercase text-[11px] tracking-wider select-none sticky top-0 z-10">
              <th className="w-12 py-3 px-3 text-center border-r border-slate-300 font-bold text-slate-700">
                #
              </th>
              <th
                onClick={() => handleSort('id')}
                className="py-3 px-3.5 border-r border-slate-300 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Staff ID</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('fullName')}
                className="py-3 px-3.5 border-r border-slate-300 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Staff Name</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('phone')}
                className="py-3 px-3.5 border-r border-slate-300 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Contact</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('cnic')}
                className="py-3 px-3.5 border-r border-slate-300 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>CNIC</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('designation')}
                className="py-3 px-3.5 border-r border-slate-300 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Designation</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('departmentName')}
                className="py-3 px-3.5 border-r border-slate-300 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Department</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Portal / Access</th>
              <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Username</th>
              <th className="py-3 px-3 text-center border-r border-slate-300 whitespace-nowrap">Status</th>
              <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Last Login</th>
              <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Updated By</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {paginatedList.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-slate-400 border-b border-slate-200">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldAlert className="h-8 w-8 text-slate-300" />
                    <span className="font-semibold text-sm text-slate-600">No staff records found</span>
                    <span className="text-xs text-slate-400">Try adjusting your search or filters</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedList.map((staff, idx) => {
                const isPortalUser = staff.accessType === 'PORTAL_USER';

                return (
                  <tr
                    key={staff.id}
                    className="hover:bg-slate-50/90 transition-colors border-b border-slate-200 last:border-b-0"
                  >
                    {/* 0. Row Index */}
                    <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/60 whitespace-nowrap">
                      {startIndex + idx + 1}
                    </td>

                    {/* 1. Employee Code / Staff ID */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-[#08775A] bg-[#effaf5] px-2.5 py-0.5 rounded border border-[#c2e7db]">
                        {staff.employeeCode || `STF-${staff.id.slice(0, 8).toUpperCase()}`}
                      </span>
                    </td>

                    {/* 2. Staff Name */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap font-semibold text-slate-900">
                      {staff.fullName}
                    </td>

                    {/* 3. Contact / Phone */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {staff.phone || '—'}
                    </td>

                    {/* 4. CNIC */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {staff.cnic || '—'}
                    </td>

                    {/* 5. Designation */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap font-medium text-slate-800">
                      {staff.designation || staff.staffCategory || '—'}
                    </td>

                    {/* 6. Department */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-slate-700">
                      {staff.departmentName ||
                        (staff.departmentNames && staff.departmentNames.length > 0
                          ? staff.departmentNames.join(', ')
                          : '—')}
                    </td>

                    {/* 7. Portal / Access */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap">
                      {getPortalBadge(staff)}
                    </td>

                    {/* 8. Username */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 font-mono text-xs text-slate-800 whitespace-nowrap">
                      {isPortalUser && staff.username ? staff.username : '—'}
                    </td>

                    {/* 9. Status */}
                    <td className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                      {getStatusBadge(staff.status)}
                    </td>

                    {/* 10. Last Login */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {staff.lastLoginAt ? formatDateTimeDDMMYYYY(staff.lastLoginAt) : 'Never'}
                    </td>

                    {/* 11. Updated By */}
                    <td className="py-2.5 px-3.5 border-r border-slate-200 text-xs text-slate-600 max-w-[150px] truncate whitespace-nowrap" title={staff.updatedBy}>
                      {staff.updatedBy || '—'}
                    </td>

                    {/* 12. Actions */}
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {/* View */}
                        <button
                          onClick={() => onView(staff)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-[#0e7d5a] hover:bg-[#e7f6f1] transition-colors cursor-pointer"
                          title="View Staff Profile & Governance"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onEdit(staff)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-[#129b70] hover:bg-[#e7f6f1] transition-colors cursor-pointer"
                          title="Edit Staff Record"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Reset Password (Portal User only) */}
                        {isPortalUser && (
                          <button
                            onClick={() => onResetPassword(staff)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Reset Portal Password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Portal Access */}
                        <button
                          onClick={() => onPortalAccess(staff)}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            isPortalUser ? 'text-[#08775A] hover:bg-[#e7f6f1]' : 'text-slate-500 hover:text-[#129b70] hover:bg-[#e7f6f1]'
                          }`}
                          title={isPortalUser ? 'Manage Portal Access' : 'Grant Portal Access'}
                        >
                          <ShieldPlus className="h-3.5 w-3.5" />
                        </button>

                        {/* Clinical Discharge Authorization (doctors only) */}
                        {staff.staffCategory === 'Doctor' && (
                          <button
                            onClick={() => onClinicalAuth(staff)}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              staff.clinicalAuthActive
                                ? 'text-[#08775A] hover:bg-[#e7f6f1]'
                                : 'text-slate-500 hover:text-[#08775A] hover:bg-[#e7f6f1]'
                            }`}
                            title={
                              staff.clinicalAuthUsername
                                ? `Clinical Discharge Authorization — ${staff.clinicalAuthActive ? 'Active' : 'Inactive'}`
                                : 'Set Up Clinical Discharge Authorization'
                            }
                          >
                            <Stethoscope className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Salary Profile */}
                        <button
                          onClick={() => onSalaryProfile(staff)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                          title="Salary Profile"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                        </button>

                        {/* Status Toggles */}
                        {staff.status === 'ACTIVE' ? (
                          <>
                            <button
                              onClick={() => onOpenStatusModal(staff, 'INACTIVE')}
                              className="p-1.5 rounded-md text-slate-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                              title="Deactivate Account"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenStatusModal(staff, 'SUSPENDED')}
                              className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              title="Suspend Account"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onOpenStatusModal(staff, 'ACTIVE')}
                            className="p-1.5 rounded-md text-slate-500 hover:text-[#0e7d5a] hover:bg-[#e7f6f1] transition-colors cursor-pointer"
                            title="Reactivate Account"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => onDelete(staff)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Staff Record (Checks Activity)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>


      {/* Pagination Footer */}
      <div className="py-3 px-4 bg-[#f6f8f7] border-t border-[#e2eae5] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#52665e]">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-[#111827]">{sortedList.length === 0 ? 0 : startIndex + 1}</strong> to{' '}
            <strong className="text-[#111827]">
              {Math.min(startIndex + pageSize, sortedList.length)}
            </strong>{' '}
            of <strong className="text-[#111827]">{sortedList.length}</strong> staff entries
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-[#8b9e95]">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-1 px-2 bg-white border border-[#e2eae5] rounded-md text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#129b70]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-md border border-[#e2eae5] bg-white text-[#52665e] hover:bg-[#f6f8f7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 py-1 font-semibold text-[#111827]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-md border border-[#e2eae5] bg-white text-[#52665e] hover:bg-[#f6f8f7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
