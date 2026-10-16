import React from 'react';
import { X, Printer, Shield, FileText, CheckCircle2, Lock } from 'lucide-react';
import { AdminUser, AdminUserFilterState } from '../../../types/adminUser';
import { User } from '../../../types';
import { getHospitalProfile, getProfileFieldValue } from '../../../services/hospitalProfileService';
import { formatDisplayDate } from '../../../utils/dateConstants';
import { printAdminUsers } from '../../../services/adminUserExportService';

interface AdminUserDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AdminUser[];
  filters: AdminUserFilterState;
  currentUser: User | null;
  targetUser?: AdminUser | null;
}

export const AdminUserDossierModal: React.FC<AdminUserDossierModalProps> = ({
  isOpen,
  onClose,
  users,
  filters,
  currentUser,
  targetUser,
}) => {
  if (!isOpen) return null;

  const profile = getHospitalProfile();
  const now = new Date();
  const displayList = targetUser ? [targetUser] : users;

  const handlePrint = () => {
    printAdminUsers(displayList, filters, currentUser);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        id="admin-dossier-modal"
        className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-6 transition-all"
      >
        {/* Modal Toolbar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#2dd4bf]" />
            <span className="text-xs font-bold tracking-tight">
              {targetUser
                ? `Administrative Dossier: ${targetUser.fullName}`
                : `Official Governance Dossier (${displayList.length} Administrative Records)`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065e46] rounded-lg transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Dossier Document Surface */}
        <div className="p-6 max-h-[75vh] overflow-y-auto bg-slate-50/50 space-y-6">
          {/* Institutional Document Header */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 border-b-2 border-[#08775A] pb-4 mb-4">
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {profile.name || 'CH Sharif and Saeed Hospital'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Executive Hospital Information System • Governance & Administrative Accounts
                </p>
                <div className="text-[11px] text-slate-500 mt-2 flex flex-wrap gap-x-4">
                  <span>Reg No: <strong>{getProfileFieldValue(profile.registrationNumber)}</strong></span>
                  <span>NTN/Tax: <strong>{getProfileFieldValue(profile.taxNumber)}</strong></span>
                  <span>Phone: <strong>{getProfileFieldValue(profile.primaryPhone)}</strong></span>
                </div>
              </div>
              <div className="bg-[#effaf5] border border-[#c2e7db] text-[#08775A] px-3 py-1.5 rounded-lg text-right">
                <div className="text-xs font-bold uppercase tracking-wider">
                  Governance Record
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {formatDisplayDate(now)}
                </div>
              </div>
            </div>

            {/* Meta row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[10.5px]">Authorized By:</span>
                <span className="font-semibold text-slate-800">
                  {currentUser ? `${currentUser.name} (${currentUser.role})` : 'Unauthenticated Session'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10.5px]">Classification:</span>
                <span className="font-semibold text-rose-700">
                  CONFIDENTIAL • INTERNAL GOVERNANCE ONLY
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10.5px]">Total In Scope:</span>
                <span className="font-semibold text-slate-800">
                  {displayList.length} Administrator Accounts
                </span>
              </div>
            </div>
          </div>

          {/* Dossier Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#08775A] text-white text-[11px] font-semibold">
                <tr>
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Emp Code</th>
                  <th className="py-2.5 px-3">Administrator Name</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last Sign-in</th>
                  <th className="py-2.5 px-3">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {u.id}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {u.employeeCode || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{u.fullName}</span>
                        {u.role === 'SUPER_ADMIN' && (
                          <Lock className="h-3 w-3 text-[#08775A]" />
                        )}
                      </div>
                      <div className="text-[10px] font-normal text-slate-400 font-mono">
                        {u.email}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {u.username}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold ${
                          u.role === 'SUPER_ADMIN'
                            ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : u.status === 'SUSPENDED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {u.lastLoginAt || 'Never'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {u.createdBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            CH Sharif and Saeed Hospital • Directorate of Medical Administration & Governance
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
