import React, { useState } from 'react';
import {
  Eye,
  Edit2,
  Key,
  Power,
  Trash2,
  Shield,
  UserCheck,
  Lock,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  MoreVertical,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { AdminUser, AdminUserStatus } from '../../../types/adminUser';
import { AdminUserService } from '../../../services/adminUserService';
import { User } from '../../../types';

interface AdminUsersTableProps {
  users: AdminUser[];
  currentUser: User | null;
  onViewDetails: (user: AdminUser) => void;
  onEdit: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onChangeStatus: (user: AdminUser, newStatus: AdminUserStatus) => void;
  onDelete: (user: AdminUser) => void;
  onRefresh: () => void;
}

export const AdminUsersTable: React.FC<AdminUsersTableProps> = ({
  users,
  currentUser,
  onViewDetails,
  onEdit,
  onResetPassword,
  onChangeStatus,
  onDelete,
  onRefresh,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [guardAlertMessage, setGuardAlertMessage] = useState<string | null>(null);

  const isActorSuperAdmin = AdminUserService.isActorSuperAdmin(currentUser);

  // Pagination Math
  const totalRecords = users.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  const paginatedUsers = users.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleProtectedActionAttempt = (target: AdminUser, actionName: string) => {
    if ((target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') && !isActorSuperAdmin) {
      setGuardAlertMessage(
        target.role === 'SUPER_ADMIN'
          ? 'This Super Admin account is protected and cannot be modified by an Admin user.'
          : 'Only a Super Admin can manage Admin accounts.'
      );
      return;
    }

    const isSelf =
      (currentUser?.id && target.id === currentUser.id) ||
      (currentUser?.username &&
        target.username.toLowerCase() === currentUser.username.toLowerCase());

    if (isSelf && (actionName === 'deactivate' || actionName === 'delete')) {
      setGuardAlertMessage('You cannot disable your currently active account.');
      return;
    }
  };

  return (
    <div
      id="admin-users-table-container"
      className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col"
    >
      {/* Table Header Bar */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 tracking-tight">
            Administrative Accounts Directory
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-semibold font-mono">
            {totalRecords} Records
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Page size selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Show:</span>
            <select
              id="admin-table-pagesize-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-xs px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#149E75]"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <button
            id="admin-table-refresh-btn"
            type="button"
            onClick={onRefresh}
            className="p-1.5 text-slate-500 hover:text-[#08775A] hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh list"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Guard Warning Toast Alert (if user clicks blocked action) */}
      {guardAlertMessage && (
        <div className="m-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{guardAlertMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setGuardAlertMessage(null)}
            className="text-rose-500 hover:text-rose-700 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Table Data */}
      <div className="overflow-x-auto min-h-[320px]">
        {paginatedUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Shield className="h-10 w-10 mx-auto text-slate-300 stroke-1" />
            <div className="text-xs font-semibold text-slate-600">
              No matching administrative users found
            </div>
            <div className="text-[11px] text-slate-400">
              Try adjusting your search criteria or role / status filters.
            </div>
          </div>
        ) : (
          <table id="admin-users-table" className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">User ID</th>
                <th className="py-2.5 px-3.5">Administrator</th>
                <th className="py-2.5 px-3.5">Username</th>
                <th className="py-2.5 px-3.5">Contact</th>
                <th className="py-2.5 px-3.5">Role</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5">Last Login</th>
                <th className="py-2.5 px-3.5">Created Date</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedUsers.map((u) => {
                const isSuperAdmin = u.role === 'SUPER_ADMIN';
                const canModify = AdminUserService.canActorModifyTarget(currentUser, u).allowed;
                const isSelf =
                  (currentUser?.id && u.id === currentUser.id) ||
                  (currentUser?.username &&
                    u.username.toLowerCase() === currentUser.username.toLowerCase());

                return (
                  <tr
                    key={u.id}
                    id={`admin-row-${u.id}`}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* User ID */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-xs text-[#08775A] bg-[#effaf5] px-2.5 py-1 rounded-md border border-[#c2e7db]">
                        {u.employeeCode || `ADM-${u.id.slice(0, 8).toUpperCase()}`}
                      </span>
                    </td>

                    {/* Admin Name */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0 border border-slate-200">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{u.fullName}</span>
                            {isSuperAdmin && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]"
                                title="Super Admin Account - Institutional Root"
                              >
                                <Lock className="h-2.5 w-2.5" />
                                Protected
                              </span>
                            )}
                            {isSelf && (
                              <span className="text-[9.5px] px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="py-2.5 px-3.5 font-mono text-slate-700 whitespace-nowrap">
                      @{u.username}
                    </td>

                    {/* Contact */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="text-slate-800 font-medium">{u.email}</div>
                      <div className="text-[10px] text-slate-400">{u.phone || '—'}</div>
                    </td>

                    {/* Role */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          isSuperAdmin
                            ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {isSuperAdmin ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <UserCheck className="h-3 w-3" />
                        )}
                        {isSuperAdmin ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : u.status === 'SUSPENDED'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    {/* Last Login */}
                    <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                      {u.lastLoginAt || 'Never'}
                    </td>

                    {/* Created Date */}
                    <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                      {u.createdAt}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* 1. View Details (Always allowed) */}
                        <button
                          type="button"
                          onClick={() => onViewDetails(u)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#08775A] transition-colors"
                          title="View Administrative Profile"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* 2. Edit */}
                        {canModify ? (
                          <button
                            type="button"
                            onClick={() => onEdit(u)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#08775A] transition-colors"
                            title="Edit Account Details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleProtectedActionAttempt(u, 'edit')}
                            className="p-1.5 text-slate-300 hover:text-slate-400 cursor-not-allowed"
                            title="Protected Super Admin Account"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* 3. Reset Password */}
                        {canModify ? (
                          <button
                            type="button"
                            onClick={() => onResetPassword(u)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#08775A] transition-colors"
                            title="Reset Temporary Password"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleProtectedActionAttempt(u, 'resetPassword')}
                            className="p-1.5 text-slate-300 hover:text-slate-400 cursor-not-allowed"
                            title="Protected Super Admin Account"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* 4. Status Controls: Deactivate / Suspend / Reactivate */}
                        {canModify ? (
                          u.status === 'ACTIVE' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSelf) {
                                    handleProtectedActionAttempt(u, 'deactivate');
                                    return;
                                  }
                                  onChangeStatus(u, 'INACTIVE');
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isSelf
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                }`}
                                title={
                                  isSelf
                                    ? 'Cannot disable your own active account'
                                    : 'Deactivate Account'
                                }
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSelf) {
                                    handleProtectedActionAttempt(u, 'deactivate');
                                    return;
                                  }
                                  onChangeStatus(u, 'SUSPENDED');
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isSelf
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                                title={
                                  isSelf
                                    ? 'Cannot suspend your own active account'
                                    : 'Suspend Account'
                                }
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onChangeStatus(u, 'ACTIVE')}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Reactivate Account"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleProtectedActionAttempt(u, 'deactivate')}
                            className="p-1.5 text-slate-300 hover:text-slate-400 cursor-not-allowed"
                            title="Protected Super Admin Account"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* 5. Delete (Only if not self, and target is standard admin or superadmin deleted by superadmin with 0 logs) */}
                        {canModify && !isSelf && (
                          <button
                            type="button"
                            onClick={() => onDelete(u)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Admin Account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong className="font-semibold text-slate-800">{startIndex + 1}</strong> to{' '}
            <strong className="font-semibold text-slate-800">{endIndex}</strong> of{' '}
            <strong className="font-semibold text-slate-800">{totalRecords}</strong> administrative records
          </div>

          <div className="flex items-center gap-1">
            <button
              id="admin-table-prev-page-btn"
              type="button"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="p-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePageChange(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                  currentPage === p
                    ? 'bg-[#08775A] text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              id="admin-table-next-page-btn"
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="p-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
