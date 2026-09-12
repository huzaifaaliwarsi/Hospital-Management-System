import React from 'react';
import { Users, KeyRound, CheckCircle2, AlertOctagon, UserCheck } from 'lucide-react';
import { StaffUser } from '../../../types/staffUser';

interface StaffUsersKPIBarProps {
  staffList: StaffUser[];
}

export const StaffUsersKPIBar: React.FC<StaffUsersKPIBarProps> = ({ staffList }) => {
  const total = staffList.length;
  const portalUsers = staffList.filter((s) => s.accessType === 'PORTAL_USER').length;
  const staffRecordOnly = staffList.filter((s) => s.accessType === 'STAFF_RECORD_ONLY').length;
  const active = staffList.filter((s) => s.status === 'ACTIVE').length;
  const inactiveOrSuspended = staffList.filter(
    (s) => s.status === 'INACTIVE' || s.status === 'SUSPENDED'
  ).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
      {/* 1. Total Staff */}
      <div className="bg-white border border-[#e2eae5] rounded-xl p-4 shadow-sm hover:border-[#129b70]/40 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#52665e] uppercase tracking-wider">
            Total Staff
          </span>
          <div className="h-8 w-8 rounded-lg bg-[#e7f6f1] text-[#129b70] flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-[#111827]">{total}</div>
        <p className="text-[11px] text-[#8b9e95] mt-1">Hospital operational roster</p>
      </div>

      {/* 2. Portal Users */}
      <div className="bg-white border border-[#e2eae5] rounded-xl p-4 shadow-sm hover:border-[#129b70]/40 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#52665e] uppercase tracking-wider">
            Portal Users
          </span>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <KeyRound className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-emerald-700">{portalUsers}</div>
        <p className="text-[11px] text-[#8b9e95] mt-1">Workstation sign-in enabled</p>
      </div>

      {/* 3. Staff Record Only */}
      <div className="bg-white border border-[#e2eae5] rounded-xl p-4 shadow-sm hover:border-[#129b70]/40 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#52665e] uppercase tracking-wider">
            Directory Only
          </span>
          <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-sky-700">{staffRecordOnly}</div>
        <p className="text-[11px] text-[#8b9e95] mt-1">Clinical / no portal credentials</p>
      </div>

      {/* 4. Active Staff */}
      <div className="bg-white border border-[#e2eae5] rounded-xl p-4 shadow-sm hover:border-[#129b70]/40 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#52665e] uppercase tracking-wider">
            Active Staff
          </span>
          <div className="h-8 w-8 rounded-lg bg-[#e7f6f1] text-[#0e7d5a] flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-[#0e7d5a]">{active}</div>
        <p className="text-[11px] text-[#8b9e95] mt-1">In good operational standing</p>
      </div>

      {/* 5. Inactive / Suspended */}
      <div className="bg-white border border-[#e2eae5] rounded-xl p-4 shadow-sm hover:border-[#129b70]/40 transition-colors col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#52665e] uppercase tracking-wider">
            Inactive / Suspended
          </span>
          <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <AlertOctagon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-amber-700">{inactiveOrSuspended}</div>
        <p className="text-[11px] text-[#8b9e95] mt-1">Access revoked / paused</p>
      </div>
    </div>
  );
};
